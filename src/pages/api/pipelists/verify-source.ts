import type { NextApiRequest, NextApiResponse } from 'next';

const MAX_URLS = 40;
const MAX_HTML_CHARS = 180000;

type SourceVerification = {
  url: string;
  valid: boolean;
  status: number;
  finalUrl: string;
  title: string;
  reason?: string;
};

const normalizeUrl = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed : null;
  } catch {
    return null;
  }
};

const decodeHtml = (value: string) =>
  value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();

const extractTitle = (value: string) => {
  const match = value.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtml(match[1]).slice(0, 240) : '';
};

const looksUnavailable = (title: string, text: string) =>
  /(?:page|profile|content|resource)[\s\S]{0,100}(?:not found|not available|doesn['’]t exist)|(?:404|410)\s*(?:error|not found)|couldn['’]t find (?:the )?(?:page|profile|content)|sorry,? this page doesn['’]t exist/i.test(
    `${title}\n${text.slice(0, 5000)}`,
  );

const verifyUrl = async (url: string): Promise<SourceVerification> => {
  const parsedUrl = normalizeUrl(url);
  if (!parsedUrl) {
    return { url, valid: false, status: 0, finalUrl: '', title: '', reason: 'Invalid URL.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(parsedUrl.toString(), {
      redirect: 'follow',
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
        'user-agent': 'Pulse PipeLists source verifier (+https://fitwithpulse.ai)',
      },
      signal: controller.signal,
    });
    const finalUrl = response.url || parsedUrl.toString();
    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();
    const title = contentType.includes('html') ? extractTitle(raw) : '';
    const text = decodeHtml(raw.slice(0, MAX_HTML_CHARS));

    if (!response.ok) {
      return { url, valid: false, status: response.status, finalUrl, title, reason: `HTTP ${response.status}.` };
    }

    if (looksUnavailable(title, text)) {
      return { url, valid: false, status: response.status, finalUrl, title, reason: 'The page reports that the content is unavailable.' };
    }

    return { url, valid: true, status: response.status, finalUrl, title };
  } catch (error) {
    return {
      url,
      valid: false,
      status: 0,
      finalUrl: '',
      title: '',
      reason: error instanceof Error && error.name === 'AbortError' ? 'The page took too long to respond.' : 'The page could not be reached.',
    };
  } finally {
    clearTimeout(timeout);
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Please sign in before verifying sources.' });
  }

  const rawUrls: unknown[] = Array.isArray(req.body?.urls) ? req.body.urls : [];
  const urls = Array.from(
    new Set(
      rawUrls
        .filter((url): url is string => typeof url === 'string')
        .map((url) => url.trim())
        .filter(Boolean),
    ),
  ).slice(0, MAX_URLS);

  if (urls.length === 0) return res.status(400).json({ error: 'At least one source URL is required.' });

  const results = await Promise.all(urls.map(verifyUrl));
  return res.status(200).json({ success: true, results });
}
