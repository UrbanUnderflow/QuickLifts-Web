import type { NextApiRequest, NextApiResponse } from 'next';
import * as Brevo from '@getbrevo/brevo';
import admin from '../../../lib/firebase-admin';

const COLLECTION = 'pulseCheckTechDemoViews';
const NOTIFICATION_TO_EMAIL = 'tre@fitwithpulse.ai';
const NOTIFICATION_TO_NAME = 'Tremaine Grant';
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'hello@pulsecommunity.app';
const SENDER_NAME = 'Pulse Intelligence Labs';

type RecordViewBody = {
  visitorId?: string;
  pageUrl?: string;
  referrer?: string;
  viewerName?: string;
  viewerEmail?: string;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

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
  const country = req.headers['x-vercel-ip-country'] as string | undefined;
  const city = req.headers['x-vercel-ip-city'] as string | undefined;
  if (country || city) {
    return [city, country].filter(Boolean).join(', ') || 'Unknown';
  }

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

async function getLocationFromIp(ip: string): Promise<string> {
  if (isPrivateOrLoopback(ip)) return 'Local';
  try {
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return 'Unknown';
    const data = (await response.json()) as {
      city?: string;
      region?: string;
      country_name?: string;
      error?: boolean;
    };
    if (data.error) return 'Unknown';
    const parts = [data.city, data.region, data.country_name].filter(Boolean) as string[];
    return parts.length ? parts.join(', ') : 'Unknown';
  } catch {
    return 'Unknown';
  }
}

function getBody(req: NextApiRequest): RecordViewBody {
  try {
    return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};
  } catch {
    return {};
  }
}

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function detailRow(label: string, value: string | null): string {
  return `
    <tr>
      <td style="padding:9px 0;color:#8b8b92;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;width:150px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:9px 0;color:#ffffff;font-size:14px;line-height:1.5;vertical-align:top;">${escapeHtml(value || 'Unknown')}</td>
    </tr>
  `;
}

async function sendViewNotification(args: {
  ip: string;
  location: string;
  userAgent: string | null;
  visitorId: string | null;
  pageUrl: string | null;
  referrer: string | null;
  viewerName: string | null;
  viewerEmail: string | null;
  source: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  viewedAt: Date;
}): Promise<{ status: string; messageId?: string | null; error?: string | null }> {
  if (!process.env.BREVO_MARKETING_KEY) {
    return { status: 'skipped_missing_brevo_key' };
  }

  const client = new Brevo.TransactionalEmailsApi();
  client.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_MARKETING_KEY);

  const viewerLabel = args.viewerName || args.viewerEmail || 'Unknown visitor';
  const viewedAtLabel = args.viewedAt.toUTCString();
  const htmlContent = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;max-width:680px;margin:0 auto;background:#080808;color:#f4f4f5;border:1px solid #242424;border-radius:14px;overflow:hidden;">
      <div style="padding:24px 26px;background:linear-gradient(135deg,rgba(200,255,0,0.14),rgba(74,217,255,0.08));border-bottom:1px solid #242424;">
        <div style="font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#c8ff00;">Pulse Check Tech Demo</div>
        <h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;line-height:1.25;">Someone viewed the demo page</h1>
      </div>
      <div style="padding:22px 26px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          ${detailRow('Viewer', viewerLabel)}
          ${detailRow('Viewer email', args.viewerEmail)}
          ${detailRow('Viewed at', viewedAtLabel)}
          ${detailRow('Location', args.location)}
          ${detailRow('IP address', args.ip)}
          ${detailRow('Visitor ID', args.visitorId)}
          ${detailRow('Source', args.source)}
          ${detailRow('UTM source', args.utmSource)}
          ${detailRow('UTM medium', args.utmMedium)}
          ${detailRow('UTM campaign', args.utmCampaign)}
          ${detailRow('Page URL', args.pageUrl)}
          ${detailRow('Referrer', args.referrer)}
          ${detailRow('User agent', args.userAgent)}
        </table>
      </div>
    </div>
  `;

  const textContent = [
    'Pulse Check Tech Demo viewed',
    '',
    `Viewer: ${viewerLabel}`,
    `Viewer email: ${args.viewerEmail || 'Unknown'}`,
    `Viewed at: ${viewedAtLabel}`,
    `Location: ${args.location}`,
    `IP address: ${args.ip}`,
    `Visitor ID: ${args.visitorId || 'Unknown'}`,
    `Source: ${args.source || 'Unknown'}`,
    `UTM source: ${args.utmSource || 'Unknown'}`,
    `UTM medium: ${args.utmMedium || 'Unknown'}`,
    `UTM campaign: ${args.utmCampaign || 'Unknown'}`,
    `Page URL: ${args.pageUrl || 'Unknown'}`,
    `Referrer: ${args.referrer || 'Unknown'}`,
    `User agent: ${args.userAgent || 'Unknown'}`,
  ].join('\n');

  try {
    const result = await client.sendTransacEmail({
      to: [{ email: NOTIFICATION_TO_EMAIL, name: NOTIFICATION_TO_NAME }],
      sender: { email: SENDER_EMAIL, name: SENDER_NAME },
      subject: `Pulse Check Tech Demo Viewed: ${viewerLabel}`,
      htmlContent,
      textContent,
    });

    const messageId = (result as { messageId?: string })?.messageId ?? null;
    return { status: 'sent', messageId };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown Brevo send error';
    console.error('[pulse-check-tech-demo/record-view] Email send failed:', message);
    return { status: 'failed', error: message };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = getBody(req);
    const ip = getClientIp(req);
    let location = getLocationFromHeaders(req);
    if (location === 'Unknown') {
      location = await getLocationFromIp(ip);
    }

    const userAgent = cleanString(req.headers['user-agent'], 1000);
    const visitorId = cleanString(body.visitorId, 128);
    const pageUrl = cleanString(body.pageUrl, 500);
    const referrer = cleanString(body.referrer, 500);
    const viewerName = cleanString(body.viewerName, 120);
    const viewerEmail = cleanString(body.viewerEmail, 180);
    const source = cleanString(body.source, 120);
    const utmSource = cleanString(body.utmSource, 120);
    const utmMedium = cleanString(body.utmMedium, 120);
    const utmCampaign = cleanString(body.utmCampaign, 180);

    let db: FirebaseFirestore.Firestore | null = null;
    try {
      db = admin.firestore();
    } catch (error: unknown) {
      console.warn('[pulse-check-tech-demo/record-view] Firestore unavailable; continuing without log:', error);
    }

    const viewedAt = new Date();
    const emailResult = await sendViewNotification({
      ip,
      location,
      userAgent,
      visitorId,
      pageUrl,
      referrer,
      viewerName,
      viewerEmail,
      source,
      utmSource,
      utmMedium,
      utmCampaign,
      viewedAt,
    });

    if (db) {
      await db.collection(COLLECTION).add({
        ip,
        location,
        userAgent,
        visitorId,
        pageUrl,
        referrer,
        viewerName,
        viewerEmail,
        source,
        utmSource,
        utmMedium,
        utmCampaign,
        notificationEmail: {
          to: NOTIFICATION_TO_EMAIL,
          status: emailResult.status,
          messageId: emailResult.messageId ?? null,
          error: emailResult.error ?? null,
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      }).catch((error: unknown) => {
        console.warn('[pulse-check-tech-demo/record-view] Firestore log failed:', error);
      });
    }

    return res.status(204).end();
  } catch (error: unknown) {
    console.error('[pulse-check-tech-demo/record-view] Error:', error);
    return res.status(500).json({ error: 'Failed to record tech demo view' });
  }
}
