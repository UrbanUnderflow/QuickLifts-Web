import { lookup as lookupDns } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdminApp } from '../../../lib/firebase-admin';
import {
  normalizeScheduleScopeId,
  requirePulseCheckScheduleAccess,
} from '../../../lib/server/pulsecheckScheduleAccess';

const FETCH_DEADLINE_MS = 8_000;
const PER_REQUEST_TIMEOUT_MS = 5_000;
const MAX_HTML_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;
const MAX_TEXT_CHARS = 16_000;
const MAX_URL_CHARS = 2_048;

type ResolvedPublicAddress = {
  address: string;
  family: 4 | 6;
};

class ScheduleScrapeError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ScheduleScrapeError';
    this.statusCode = statusCode;
  }
}

const headerValue = (
  value: string | string[] | undefined
): string => Array.isArray(value) ? value[0] || '' : value || '';

const normalizeHostname = (hostname: string): string =>
  hostname.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');

const ipv4Number = (address: string): number | null => {
  const parts = address.split('.');
  if (
    parts.length !== 4
    || parts.some((part) => !/^\d{1,3}$/.test(part))
  ) {
    return null;
  }
  const octets = parts.map(Number);
  if (octets.some((octet) => octet < 0 || octet > 255)) return null;
  return (
    ((octets[0] << 24) >>> 0)
    + (octets[1] << 16)
    + (octets[2] << 8)
    + octets[3]
  ) >>> 0;
};

const inIpv4Range = (
  address: number,
  base: string,
  prefixLength: number
): boolean => {
  const baseNumber = ipv4Number(base);
  if (baseNumber == null) return false;
  const mask = prefixLength === 0
    ? 0
    : (0xffffffff << (32 - prefixLength)) >>> 0;
  return (address & mask) === (baseNumber & mask);
};

const isPublicIpv4Address = (address: string): boolean => {
  const numericAddress = ipv4Number(address);
  if (numericAddress == null) return false;

  const blockedRanges: Array<[string, number]> = [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.88.99.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
  ];
  return !blockedRanges.some(([base, prefix]) =>
    inIpv4Range(numericAddress, base, prefix)
  );
};

const expandIpv6 = (address: string): number[] | null => {
  let normalized = address.toLowerCase().split('%')[0];
  const mappedIpv4Index = normalized.lastIndexOf(':');
  const mappedIpv4 = normalized.slice(mappedIpv4Index + 1);
  if (mappedIpv4.includes('.')) {
    const mappedNumeric = ipv4Number(mappedIpv4);
    if (mappedNumeric == null) return null;
    normalized = `${normalized.slice(0, mappedIpv4Index)}:${
      ((mappedNumeric >>> 16) & 0xffff).toString(16)
    }:${(mappedNumeric & 0xffff).toString(16)}`;
  }

  const halves = normalized.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if (
    missing < 0
    || (halves.length === 1 && missing !== 0)
    || (halves.length === 2 && missing < 1)
  ) {
    return null;
  }

  const groups = [
    ...left,
    ...Array.from({ length: missing }, () => '0'),
    ...right,
  ];
  if (
    groups.length !== 8
    || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))
  ) {
    return null;
  }
  return groups.map((group) => Number.parseInt(group, 16));
};

const isPublicIpv6Address = (address: string): boolean => {
  const groups = expandIpv6(address);
  if (!groups) return false;

  const isIpv4Mapped =
    groups.slice(0, 5).every((group) => group === 0)
    && groups[5] === 0xffff;
  if (isIpv4Mapped) {
    const mappedIpv4 = [
      groups[6] >>> 8,
      groups[6] & 0xff,
      groups[7] >>> 8,
      groups[7] & 0xff,
    ].join('.');
    return isPublicIpv4Address(mappedIpv4);
  }

  // Public Internet IPv6 destinations use global unicast space (2000::/3).
  if ((groups[0] & 0xe000) !== 0x2000) return false;

  // Documentation, benchmarking, ORCHID, and Teredo ranges are not public
  // web destinations for this fetcher.
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return false;
  if (
    groups[0] === 0x2001
    && (
      groups[1] === 0x0000
      || groups[1] === 0x0002
      || (groups[1] >= 0x0010 && groups[1] <= 0x002f)
    )
  ) {
    return false;
  }
  return true;
};

export const isPublicScheduleIpAddress = (address: string): boolean => {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4Address(address);
  if (family === 6) return isPublicIpv6Address(address);
  return false;
};

export const normalizePublicScheduleUrl = (value: unknown): URL => {
  const rawValue = typeof value === 'string' ? value.trim() : '';
  if (!rawValue || rawValue.length > MAX_URL_CHARS) {
    throw new ScheduleScrapeError('Enter a valid schedule link.', 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`);
  } catch {
    throw new ScheduleScrapeError('Enter a valid schedule link.', 400);
  }
  if (
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    || parsed.username
    || parsed.password
  ) {
    throw new ScheduleScrapeError(
      'Schedule links must use a public http or https address.',
      400
    );
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (
    !hostname
    || hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
  ) {
    throw new ScheduleScrapeError(
      'Schedule links must point to a public website.',
      400
    );
  }
  return parsed;
};

const resolvePublicAddress = async (
  parsed: URL,
  deadline: number
): Promise<ResolvedPublicAddress> => {
  const hostname = normalizeHostname(parsed.hostname);
  const literalFamily = isIP(hostname);
  let addresses: Array<{ address: string; family: number }>;
  if (literalFamily) {
    addresses = [{ address: hostname, family: literalFamily }];
  } else {
    const remainingTime = deadline - Date.now();
    if (remainingTime <= 0) {
      throw new ScheduleScrapeError(
        'The page took too long to respond.',
        504
      );
    }
    let timeoutHandle: NodeJS.Timeout | undefined;
    try {
      addresses = await Promise.race([
        lookupDns(hostname, { all: true, verbatim: true }),
        new Promise<never>((_resolve, reject) => {
          timeoutHandle = setTimeout(
            () => reject(
              new ScheduleScrapeError(
                'The page took too long to respond.',
                504
              )
            ),
            remainingTime
          );
        }),
      ]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  if (
    addresses.length === 0
    || addresses.some((candidate) => !isPublicScheduleIpAddress(candidate.address))
  ) {
    throw new ScheduleScrapeError(
      'Schedule links must point to a public website.',
      400
    );
  }
  const selected = addresses[0];
  return {
    address: selected.address,
    family: selected.family === 6 ? 6 : 4,
  };
};

const fetchHtmlOnce = async (
  parsed: URL,
  deadline: number
): Promise<{ body?: string; redirect?: URL }> => {
  const remainingTime = deadline - Date.now();
  if (remainingTime <= 0) {
    throw new ScheduleScrapeError(
      'The page took too long to respond.',
      504
    );
  }

  const resolved = await resolvePublicAddress(parsed, deadline);
  const remainingAfterDns = deadline - Date.now();
  if (remainingAfterDns <= 0) {
    throw new ScheduleScrapeError(
      'The page took too long to respond.',
      504
    );
  }
  const client = parsed.protocol === 'https:' ? https : http;
  const requestTimeout = Math.max(
    1,
    Math.min(PER_REQUEST_TIMEOUT_MS, remainingAfterDns)
  );

  return new Promise((resolve, reject) => {
    let settled = false;
    let deadlineTimer: NodeJS.Timeout | undefined;
    let request: http.ClientRequest;
    const finish = (
      error: Error | null,
      value?: { body?: string; redirect?: URL }
    ) => {
      if (settled) return;
      settled = true;
      if (deadlineTimer) clearTimeout(deadlineTimer);
      if (error) reject(error);
      else resolve(value || {});
    };

    deadlineTimer = setTimeout(() => {
      request?.destroy();
      finish(
        new ScheduleScrapeError(
          'The page took too long to respond.',
          504
        )
      );
    }, remainingAfterDns);

    request = client.request(
      parsed,
      {
        headers: {
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.8',
          'Accept-Encoding': 'identity',
          'User-Agent': 'PulseCheck-Schedule-Importer/1.0',
        },
        lookup: (
          _hostname: string,
          options: any,
          callback: (
            error: NodeJS.ErrnoException | null,
            address: string | ResolvedPublicAddress[],
            family?: number
          ) => void
        ) => {
          if (options?.all) {
            callback(null, [resolved]);
            return;
          }
          callback(null, resolved.address, resolved.family);
        },
        servername: normalizeHostname(parsed.hostname),
        timeout: requestTimeout,
      },
      (response) => {
        const status = response.statusCode || 0;
        if (status >= 300 && status < 400) {
          const location = response.headers.location;
          response.resume();
          if (!location) {
            finish(new ScheduleScrapeError('The page returned an invalid redirect.', 502));
            return;
          }
          try {
            finish(null, {
              redirect: normalizePublicScheduleUrl(new URL(location, parsed).toString()),
            });
          } catch (error) {
            finish(error as Error);
          }
          return;
        }
        if (status !== 200) {
          response.resume();
          finish(new ScheduleScrapeError(`The page returned HTTP ${status}.`, 502));
          return;
        }

        const contentType = String(response.headers['content-type'] || '')
          .split(';')[0]
          .trim()
          .toLowerCase();
        if (
          contentType
          && !['text/html', 'application/xhtml+xml', 'text/plain'].includes(contentType)
        ) {
          response.resume();
          finish(new ScheduleScrapeError('That link did not return a readable web page.', 415));
          return;
        }
        const contentEncoding = String(response.headers['content-encoding'] || '')
          .trim()
          .toLowerCase();
        if (contentEncoding && contentEncoding !== 'identity') {
          response.resume();
          finish(new ScheduleScrapeError('That page used an unsupported response format.', 415));
          return;
        }
        const declaredLength = Number(response.headers['content-length'] || 0);
        if (declaredLength > MAX_HTML_BYTES) {
          response.resume();
          finish(new ScheduleScrapeError('That page is too large to import.', 413));
          return;
        }

        const chunks: Buffer[] = [];
        let receivedBytes = 0;
        response.on('data', (chunk: Buffer | string) => {
          if (settled) return;
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          receivedBytes += buffer.length;
          if (receivedBytes > MAX_HTML_BYTES) {
            response.destroy();
            finish(new ScheduleScrapeError('That page is too large to import.', 413));
            return;
          }
          chunks.push(buffer);
        });
        response.on('end', () => {
          const bodyBuffer = Buffer.allocUnsafe(receivedBytes);
          let writeOffset = 0;
          chunks.forEach((chunk) => {
            chunk.forEach((byte) => {
              bodyBuffer[writeOffset] = byte;
              writeOffset += 1;
            });
          });
          finish(null, { body: bodyBuffer.toString('utf8') });
        });
        response.on('error', (error) => finish(error));
      }
    );
    request.on('error', (error) => finish(error));
    request.on('timeout', () => {
      request.destroy();
      finish(new ScheduleScrapeError('The page took too long to respond.', 504));
    });
    request.end();
  });
};

export const fetchPublicScheduleHtml = async (targetUrl: URL): Promise<string> => {
  const deadline = Date.now() + FETCH_DEADLINE_MS;
  let currentUrl = targetUrl;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const result = await fetchHtmlOnce(currentUrl, deadline);
    if (result.body !== undefined) return result.body;
    if (!result.redirect) {
      throw new ScheduleScrapeError('The page could not be read.', 502);
    }
    if (redirects === MAX_REDIRECTS) {
      throw new ScheduleScrapeError('That link redirected too many times.', 422);
    }
    // Every redirect gets a fresh DNS resolution, public-range check, and
    // pinned socket lookup inside fetchHtmlOnce.
    currentUrl = result.redirect;
  }
  throw new ScheduleScrapeError('That link redirected too many times.', 422);
};

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code) => {
      const parsed = Number(code);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : ' ';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => {
      const parsed = Number.parseInt(code, 16);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : ' ';
    })
    .replace(/&[a-z]+;/gi, ' ');

const coerceJsonArray = (value: unknown): any[] => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  return [];
};

const compactText = (value: unknown, limit = 160): string => (
  typeof value === 'string' ? value : ''
).replace(/\s+/g, ' ').trim().slice(0, limit);

const extractPlaceText = (location: any): string => {
  if (!location || typeof location !== 'object') return '';
  const name = compactText(location.name, 120);
  const address = location.address && typeof location.address === 'object'
    ? [
        compactText(location.address.streetAddress, 120),
        compactText(location.address.addressLocality, 80),
        compactText(location.address.addressRegion, 40),
      ].filter(Boolean).join(', ')
    : '';
  return [name, address].filter(Boolean).join(' - ');
};

const sportsEventToLine = (event: any): string | null => {
  if (!event || typeof event !== 'object') return null;
  const type = compactText(event['@type'], 60);
  if (type && type !== 'SportsEvent' && !type.split(/\s*,\s*/).includes('SportsEvent')) {
    return null;
  }

  const title = compactText(event.name, 180);
  const startsAt = compactText(event.startDate, 60);
  if (!title || !startsAt) return null;

  const home = compactText(event.homeTeam?.name, 120);
  const away = compactText(event.awayTeam?.name, 120);
  const location = extractPlaceText(event.location);
  const description = compactText(event.description, 220);
  return [
    `Event: ${title}`,
    `Starts: ${startsAt}`,
    home ? `Home: ${home}` : '',
    away ? `Away: ${away}` : '',
    location ? `Location: ${location}` : '',
    description ? `Details: ${description}` : '',
  ].filter(Boolean).join(' | ');
};

const extractSportsEventJsonLd = (html: string): string => {
  const lines: string[] = [];
  const scriptPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptPattern.exec(html)) !== null) {
    const rawJson = decodeHtmlEntities(match[1]).trim();
    if (!rawJson) continue;
    try {
      const parsed = JSON.parse(rawJson);
      for (const item of coerceJsonArray(parsed)) {
        const eventLines = sportsEventToLine(item);
        if (eventLines) lines.push(eventLines);
      }
    } catch {
      // Some athletics vendors emit relaxed JSON in unrelated ld+json blocks.
      // The visible-page fallback still gives Nora useful text.
    }
  }

  return lines.length
    ? `Structured schedule events:\n${lines.join('\n')}`
    : '';
};

/** Reduce raw HTML to readable text, preserving rows and table structure. */
export function scheduleHtmlToText(html: string): {
  title: string;
  text: string;
} {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch
    ? titleMatch[1].replace(/\s+/g, ' ').trim().slice(0, 200)
    : '';

  const visibleText = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<\/(tr|li|div|p|h[1-6]|article|section)>/gi, '\n')
    .replace(/<\/(td|th|span)>/gi, ' | ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();

  const structuredEvents = extractSportsEventJsonLd(html);
  const text = [structuredEvents, visibleText].filter(Boolean).join('\n\n');

  return { title, text: text.slice(0, MAX_TEXT_CHARS) };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const authHeader = headerValue(req.headers.authorization);
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch) {
    return res.status(401).json({ error: 'Please sign in again.' });
  }

  const teamId = normalizeScheduleScopeId(req.body?.teamId);
  const organizationId = normalizeScheduleScopeId(req.body?.organizationId);

  try {
    const targetUrl = normalizePublicScheduleUrl(req.body?.url);
    const firebaseMode = headerValue(
      req.headers['x-pulsecheck-firebase-mode']
    ).toLowerCase();
    const devFirebaseHeader = headerValue(
      req.headers['x-pulsecheck-dev-firebase']
    ).toLowerCase();
    const forceDevFirebase =
      firebaseMode === 'dev'
      || devFirebaseHeader === 'true'
      || devFirebaseHeader === '1';
    const firebaseApp = getFirebaseAdminApp(forceDevFirebase);
    let decoded: { uid?: string };
    try {
      decoded = await firebaseApp.auth().verifyIdToken(bearerMatch[1]);
    } catch {
      return res.status(401).json({ error: 'Please sign in again.' });
    }
    await requirePulseCheckScheduleAccess({
      database: firebaseApp.firestore(),
      userId: normalizeScheduleScopeId(decoded.uid),
      teamId,
      organizationId,
    });

    const html = await fetchPublicScheduleHtml(targetUrl);
    const { title, text } = scheduleHtmlToText(html);
    if (!text || text.length < 40) {
      return res.status(422).json({
        error: 'Couldn’t read anything useful from that page.',
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ title, text });
  } catch (error: any) {
    const statusCode = Number(error?.statusCode) || (
      error?.code === 'ENOTFOUND' || error?.code === 'EAI_AGAIN'
        ? 422
        : 500
    );
    const safeStatusCode =
      statusCode >= 400 && statusCode <= 599 ? statusCode : 500;
    console.error('[schedule-scrape] Request failed', {
      statusCode: safeStatusCode,
      code: error?.code || error?.name || 'UNKNOWN',
    });
    return res.status(safeStatusCode).json({
      error:
        safeStatusCode === 500
          ? 'Failed to read that link.'
          : error?.message || 'Failed to read that link.',
    });
  }
}
