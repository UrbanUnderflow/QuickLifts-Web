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
  viewerCompany?: string;
  viewerRole?: string;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  timezone?: string;
  language?: string;
  screen?: string;
  viewport?: string;
  platform?: string;
  devicePixelRatio?: string | number;
  localTimestamp?: string;
};

function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim().replace(/^::ffff:/, '');
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0]?.trim().replace(/^::ffff:/, '') ?? '';
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') return realIp.replace(/^::ffff:/, '');
  return ((req.socket?.remoteAddress as string) ?? 'unknown').replace(/^::ffff:/, '');
}

function getHeaderString(req: NextApiRequest, names: string[]): string | null {
  for (const name of names) {
    const value = req.headers[name];
    const rawValue = Array.isArray(value) ? value[0] : value;
    if (typeof rawValue !== 'string' || !rawValue.trim()) continue;

    try {
      return decodeURIComponent(rawValue.trim());
    } catch {
      return rawValue.trim();
    }
  }

  return null;
}

function getLocationFromHeaders(req: NextApiRequest): string {
  const city = getHeaderString(req, ['x-vercel-ip-city', 'x-city', 'cf-ipcity']);
  const region = getHeaderString(req, ['x-vercel-ip-country-region', 'x-region', 'cf-region']);
  const country = getHeaderString(req, ['x-vercel-ip-country', 'x-country-code', 'cf-ipcountry']);

  if (country || city || region) {
    return [city, region, country].filter(Boolean).join(', ') || 'Unknown';
  }

  return 'Unknown';
}

function isPrivateOrLoopback(ip: string): boolean {
  if (ip === 'unknown' || !ip) return true;
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('::ffff:127.')) return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) return true;
  return false;
}

type IpLookup = {
  location: string;
  org: string | null;
  timezone: string | null;
};

async function getIpLookup(ip: string): Promise<IpLookup> {
  if (isPrivateOrLoopback(ip)) return { location: 'Local', org: null, timezone: null };

  try {
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return { location: 'Unknown', org: null, timezone: null };
    const data = (await response.json()) as {
      city?: string;
      region?: string;
      country_name?: string;
      org?: string;
      timezone?: string;
      error?: boolean;
    };
    if (data.error) return { location: 'Unknown', org: null, timezone: null };
    const parts = [data.city, data.region, data.country_name].filter(Boolean) as string[];
    return {
      location: parts.length ? parts.join(', ') : 'Unknown',
      org: cleanString(data.org, 180),
      timezone: cleanString(data.timezone, 80),
    };
  } catch {
    return { location: 'Unknown', org: null, timezone: null };
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
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (['unknown', 'undefined', 'null', 'n/a'].includes(trimmed.toLowerCase())) return null;
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

function detailRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:9px 0;color:#8b8b92;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;width:150px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:9px 0;color:#ffffff;font-size:14px;line-height:1.5;vertical-align:top;">${escapeHtml(value)}</td>
    </tr>
  `;
}

function isKnown(value: string | null | undefined): value is string {
  if (!value) return false;
  return !['unknown', 'direct / unknown', 'direct / none'].includes(value.trim().toLowerCase());
}

function getQueryParamFromUrl(pageUrl: string | null, names: string[]): string | null {
  if (!pageUrl) return null;

  try {
    const params = new URL(pageUrl).searchParams;
    for (const name of names) {
      const value = cleanString(params.get(name), 240);
      if (value) return value;
    }
  } catch {
    return null;
  }

  return null;
}

function getReferrerHost(referrer: string | null): string | null {
  if (!referrer) return null;

  try {
    return new URL(referrer).hostname.replace(/^www\./, '');
  } catch {
    return referrer;
  }
}

function parseUserAgent(userAgent: string | null): {
  browser: string | null;
  os: string | null;
  deviceType: string | null;
} {
  if (!userAgent) {
    return { browser: null, os: null, deviceType: null };
  }

  const browser =
    userAgent.match(/Edg\/([\d.]+)/)?.[1]
      ? `Edge ${userAgent.match(/Edg\/([\d.]+)/)?.[1]}`
      : userAgent.match(/OPR\/([\d.]+)/)?.[1]
        ? `Opera ${userAgent.match(/OPR\/([\d.]+)/)?.[1]}`
        : userAgent.match(/Chrome\/([\d.]+)/)?.[1]
          ? `Chrome ${userAgent.match(/Chrome\/([\d.]+)/)?.[1]}`
          : userAgent.match(/Firefox\/([\d.]+)/)?.[1]
            ? `Firefox ${userAgent.match(/Firefox\/([\d.]+)/)?.[1]}`
            : userAgent.match(/Version\/([\d.]+).*Safari/)?.[1]
              ? `Safari ${userAgent.match(/Version\/([\d.]+).*Safari/)?.[1]}`
              : null;

  const macVersion = userAgent.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, '.');
  const iosVersion = userAgent.match(/(?:CPU iPhone OS|CPU OS) ([\d_]+)/)?.[1]?.replace(/_/g, '.');
  const androidVersion = userAgent.match(/Android ([\d.]+)/)?.[1];
  const windowsVersion = userAgent.match(/Windows NT ([\d.]+)/)?.[1];
  const os = iosVersion
    ? `iOS ${iosVersion}`
    : androidVersion
      ? `Android ${androidVersion}`
      : macVersion
        ? `macOS ${macVersion}`
        : windowsVersion
          ? `Windows ${windowsVersion}`
          : userAgent.includes('Linux')
            ? 'Linux'
            : null;

  const deviceType = /iPad|Tablet/i.test(userAgent)
    ? 'tablet'
    : /Mobile|iPhone|Android/i.test(userAgent)
      ? 'mobile'
      : 'desktop';

  return { browser, os, deviceType };
}

function buildDeviceSummary(args: {
  userAgent: string | null;
  platform: string | null;
  viewport: string | null;
  screen: string | null;
}): string | null {
  const parsed = parseUserAgent(args.userAgent);
  const browserOs = [parsed.browser, parsed.os].filter(Boolean).join(' on ');
  const display = [args.viewport ? `viewport ${args.viewport}` : null, args.screen ? `screen ${args.screen}` : null]
    .filter(Boolean)
    .join(', ');
  const deviceParts = [
    browserOs || parsed.deviceType,
    args.platform && !browserOs?.toLowerCase().includes(args.platform.toLowerCase()) ? args.platform : null,
    display,
  ].filter(Boolean);

  return deviceParts.length ? deviceParts.join(' · ') : null;
}

function buildTrafficLabel(args: {
  source: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrer: string | null;
}): string {
  const utmParts = [
    args.utmSource ? `utm_source=${args.utmSource}` : null,
    args.utmMedium ? `utm_medium=${args.utmMedium}` : null,
    args.utmCampaign ? `utm_campaign=${args.utmCampaign}` : null,
  ].filter(Boolean);
  const referrerHost = getReferrerHost(args.referrer);

  if (args.source && utmParts.length) return `${args.source} (${utmParts.join(', ')})`;
  if (args.source) return args.source;
  if (utmParts.length) return utmParts.join(', ');
  if (referrerHost) return `Referrer: ${referrerHost}`;
  return 'Direct visit (no referrer sent)';
}

function buildViewerLabel(args: {
  ip: string;
  location: string;
  userAgent: string | null;
  viewerName: string | null;
  viewerEmail: string | null;
  viewerCompany: string | null;
}): string {
  if (args.viewerName && args.viewerCompany) return `${args.viewerName} · ${args.viewerCompany}`;
  if (args.viewerName) return args.viewerName;
  if (args.viewerEmail && args.viewerCompany) return `${args.viewerEmail} · ${args.viewerCompany}`;
  if (args.viewerEmail) return args.viewerEmail;

  const parsed = parseUserAgent(args.userAgent);
  const device = [parsed.browser, parsed.os].filter(Boolean).join(' on ');
  if (device && isKnown(args.location)) return `Anonymous ${device} visitor from ${args.location}`;
  if (isKnown(args.location)) return `Anonymous visitor from ${args.location}`;
  if (device && isKnown(args.ip)) return `Anonymous ${device} visitor (${args.ip})`;
  if (isKnown(args.ip)) return `Anonymous visitor (${args.ip})`;
  return 'Anonymous visitor';
}

function buildRows(rows: Array<{ label: string; value: string | null; include?: boolean }>): Array<{ label: string; value: string }> {
  return rows
    .filter((row) => row.include !== false && isKnown(row.value))
    .map((row) => ({ label: row.label, value: row.value as string }));
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
  viewerCompany: string | null;
  viewerRole: string | null;
  source: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  ipOrg: string | null;
  timezone: string | null;
  language: string | null;
  screen: string | null;
  viewport: string | null;
  platform: string | null;
  devicePixelRatio: string | null;
  localTimestamp: string | null;
  viewedAt: Date;
}): Promise<{ status: string; messageId?: string | null; error?: string | null }> {
  if (!process.env.BREVO_MARKETING_KEY) {
    return { status: 'skipped_missing_brevo_key' };
  }

  const client = new Brevo.TransactionalEmailsApi();
  client.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_MARKETING_KEY);

  const viewerLabel = buildViewerLabel(args);
  const viewedAtLabel = args.viewedAt.toUTCString();
  const deviceSummary = buildDeviceSummary(args);
  const trafficLabel = buildTrafficLabel(args);
  const technicalRows = buildRows([
    { label: 'IP address', value: args.ip },
    { label: 'IP network', value: args.ipOrg },
    { label: 'Visitor ID', value: args.visitorId },
    { label: 'User agent', value: args.userAgent },
  ]);
  const primaryRows = buildRows([
    { label: 'Viewer', value: viewerLabel },
    { label: 'Viewer email', value: args.viewerEmail },
    { label: 'Company', value: args.viewerCompany },
    { label: 'Role', value: args.viewerRole },
    { label: 'Viewed at', value: viewedAtLabel },
    { label: 'Local browser time', value: args.localTimestamp },
    { label: 'Approx. location', value: args.location },
    { label: 'Timezone', value: args.timezone },
    { label: 'Language', value: args.language },
    { label: 'Device', value: deviceSummary },
    { label: 'Pixel ratio', value: args.devicePixelRatio },
    { label: 'Traffic', value: trafficLabel },
    { label: 'Source', value: args.source },
    { label: 'UTM source', value: args.utmSource },
    { label: 'UTM medium', value: args.utmMedium },
    { label: 'UTM campaign', value: args.utmCampaign },
    { label: 'Page URL', value: args.pageUrl },
    { label: 'Referrer', value: args.referrer },
  ]);
  const knownIdentityLabel = args.viewerName || args.viewerEmail ? 'Tagged reviewer' : 'Anonymous visitor';
  const locationLabel = isKnown(args.location) ? args.location : 'Location not available from headers or IP lookup';

  const htmlContent = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;max-width:680px;margin:0 auto;background:#080808;color:#f4f4f5;border:1px solid #242424;border-radius:14px;overflow:hidden;">
      <div style="padding:24px 26px;background:linear-gradient(135deg,rgba(200,255,0,0.14),rgba(74,217,255,0.08));border-bottom:1px solid #242424;">
        <div style="font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#c8ff00;">PulseCheck Tech Demo</div>
        <h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;line-height:1.25;">${escapeHtml(viewerLabel)} viewed the demo page</h1>
      </div>
      <div style="padding:22px 26px;">
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
          <span style="border:1px solid rgba(200,255,0,0.32);background:rgba(200,255,0,0.1);color:#dfff38;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:700;">${escapeHtml(knownIdentityLabel)}</span>
          <span style="border:1px solid rgba(74,217,255,0.28);background:rgba(74,217,255,0.08);color:#9cecff;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:700;">${escapeHtml(locationLabel)}</span>
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          ${primaryRows.map((row) => detailRow(row.label, row.value)).join('')}
        </table>
        <div style="margin:18px 0 8px;color:#8b8b92;font-size:12px;text-transform:uppercase;letter-spacing:0.12em;">Technical fingerprint</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          ${technicalRows.map((row) => detailRow(row.label, row.value)).join('')}
        </table>
      </div>
    </div>
  `;

  const textRows = [...primaryRows, { label: 'Identity', value: knownIdentityLabel }, ...technicalRows];
  const textContent = ['PulseCheck Tech Demo viewed', '', ...textRows.map((row) => `${row.label}: ${row.value}`)].join('\n');

  try {
    const result = await client.sendTransacEmail({
      to: [{ email: NOTIFICATION_TO_EMAIL, name: NOTIFICATION_TO_NAME }],
      sender: { email: SENDER_EMAIL, name: SENDER_NAME },
      subject: `PulseCheck Tech Demo Viewed: ${viewerLabel}`,
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
    let ipLookup: IpLookup = { location: 'Unknown', org: null, timezone: null };
    if (location === 'Unknown') {
      ipLookup = await getIpLookup(ip);
      location = ipLookup.location;
    }

    const userAgent = cleanString(req.headers['user-agent'], 1000);
    const visitorId = cleanString(body.visitorId, 128);
    const pageUrl = cleanString(body.pageUrl, 500);
    const referrer = cleanString(body.referrer, 500);
    const viewerName =
      cleanString(body.viewerName, 120) ||
      getQueryParamFromUrl(pageUrl, ['viewerName', 'name', 'investor', 'viewer', 'reviewer']);
    const viewerEmail = cleanString(body.viewerEmail, 180) || getQueryParamFromUrl(pageUrl, ['viewerEmail', 'email']);
    const viewerCompany =
      cleanString(body.viewerCompany, 160) ||
      getQueryParamFromUrl(pageUrl, ['viewerCompany', 'company', 'org', 'organization']);
    const viewerRole = cleanString(body.viewerRole, 120) || getQueryParamFromUrl(pageUrl, ['viewerRole', 'role', 'title']);
    const source = cleanString(body.source, 120) || getQueryParamFromUrl(pageUrl, ['source', 'ref', 'channel']);
    const utmSource = cleanString(body.utmSource, 120) || getQueryParamFromUrl(pageUrl, ['utm_source']);
    const utmMedium = cleanString(body.utmMedium, 120) || getQueryParamFromUrl(pageUrl, ['utm_medium']);
    const utmCampaign = cleanString(body.utmCampaign, 180) || getQueryParamFromUrl(pageUrl, ['utm_campaign']);
    const timezone = cleanString(body.timezone, 80) || ipLookup.timezone;
    const language = cleanString(body.language, 80);
    const screen = cleanString(body.screen, 80);
    const viewport = cleanString(body.viewport, 80);
    const platform = cleanString(body.platform, 120);
    const devicePixelRatio = cleanString(body.devicePixelRatio, 24);
    const localTimestamp = cleanString(body.localTimestamp, 120);
    const ipOrg = ipLookup.org;

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
      viewerCompany,
      viewerRole,
      source,
      utmSource,
      utmMedium,
      utmCampaign,
      ipOrg,
      timezone,
      language,
      screen,
      viewport,
      platform,
      devicePixelRatio,
      localTimestamp,
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
        viewerCompany,
        viewerRole,
        source,
        utmSource,
        utmMedium,
        utmCampaign,
        ipOrg,
        timezone,
        language,
        screen,
        viewport,
        platform,
        devicePixelRatio,
        localTimestamp,
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
