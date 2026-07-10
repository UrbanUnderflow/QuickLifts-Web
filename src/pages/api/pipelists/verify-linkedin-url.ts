import type { NextApiRequest, NextApiResponse } from 'next';

const LINKEDIN_TIMEOUT_MS = 12000;

const normalizeLinkedInUrl = (value: unknown) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const path = parsed.pathname.toLowerCase();
    const isLinkedIn = hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com');
    const isSupportedPath = /^\/(?:in|pub|company)\//.test(path);
    if (!isLinkedIn || !isSupportedPath) return '';

    parsed.hash = '';
    return parsed.toString();
  } catch {
    return '';
  }
};

const isLinkedIn404Url = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.pathname.toLowerCase().replace(/\/+$/, '') === '/404';
  } catch {
    return false;
  }
};

const fetchLinkedIn = async (url: string, method: 'HEAD' | 'GET') => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LINKEDIN_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      redirect: 'follow',
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'user-agent': 'Mozilla/5.0 (compatible; PulsePipeListsLinkVerifier/1.0; +https://fitwithpulse.ai)',
      },
      signal: controller.signal,
    });

    const text = method === 'GET' ? await response.text().catch(() => '') : '';
    return {
      status: response.status,
      finalUrl: response.url || url,
      text,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const classifyLinkedInResponse = (result: { status: number; finalUrl: string; text?: string }) => {
  const body = result.text || '';
  if (result.status === 404 || isLinkedIn404Url(result.finalUrl)) {
    return { verified: false, reason: 'NOT_FOUND' };
  }
  if (/this page doesn.t exist/i.test(body) || /please check your url or return to linkedin home/i.test(body)) {
    return { verified: false, reason: 'NOT_FOUND' };
  }
  if (result.status >= 200 && result.status < 400) {
    return { verified: true, reason: 'VERIFIED' };
  }
  return { verified: false, reason: `UNVERIFIED_HTTP_${result.status || 'UNKNOWN'}` };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Please sign in before verifying LinkedIn URLs.' });
  }

  const normalizedUrl = normalizeLinkedInUrl(req.body?.url);
  if (!normalizedUrl) {
    return res.status(200).json({
      verified: false,
      url: '',
      reason: 'INVALID_LINKEDIN_URL',
    });
  }

  if (isLinkedIn404Url(normalizedUrl)) {
    return res.status(200).json({
      verified: false,
      url: normalizedUrl,
      reason: 'NOT_FOUND',
    });
  }

  try {
    const headResult = await fetchLinkedIn(normalizedUrl, 'HEAD');
    const headClassification = classifyLinkedInResponse(headResult);
    if (headClassification.verified || headClassification.reason === 'NOT_FOUND') {
      return res.status(200).json({
        ...headClassification,
        url: headClassification.verified ? normalizedUrl : '',
        checkedUrl: normalizedUrl,
        finalUrl: headResult.finalUrl,
        httpStatus: headResult.status,
      });
    }

    const getResult = await fetchLinkedIn(normalizedUrl, 'GET');
    const getClassification = classifyLinkedInResponse(getResult);
    return res.status(200).json({
      ...getClassification,
      url: getClassification.verified ? normalizedUrl : '',
      checkedUrl: normalizedUrl,
      finalUrl: getResult.finalUrl,
      httpStatus: getResult.status,
    });
  } catch (error) {
    return res.status(200).json({
      verified: false,
      url: '',
      checkedUrl: normalizedUrl,
      reason: error instanceof Error && error.name === 'AbortError' ? 'VERIFY_TIMEOUT' : 'VERIFY_FAILED',
    });
  }
}
