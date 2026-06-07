import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Coach Schedule — page fetcher
 * ------------------------------------------------------------------
 * Fetches a published schedule URL server-side (no CORS) and reduces it
 * to readable text. The actual event extraction (LLM) happens client-side
 * through the shared openai-bridge so we reuse the configured key + auth +
 * per-feature rate limits. See `coachScheduleService.scrapeUrl`.
 *
 * POST /api/coach/schedule-scrape  { url: string }
 *   -> { title: string, text: string }
 */

const FETCH_TIMEOUT_MS = 12000;
const MAX_TEXT_CHARS = 16000;

function fetchHtml(targetUrl: string): Promise<string> {
  const https = require('https');
  const http = require('http');
  const { URL } = require('url');

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml',
  };

  const get = (url: string, redirects = 0): Promise<string> =>
    new Promise((resolve, reject) => {
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        reject(new Error('Invalid URL'));
        return;
      }
      const client = parsed.protocol === 'https:' ? https : http;
      const request = client.get(url, { headers, timeout: FETCH_TIMEOUT_MS }, (response: any) => {
        const status = response.statusCode || 0;
        if (status >= 300 && status < 400 && response.headers.location && redirects < 5) {
          const next = new URL(response.headers.location, url).toString();
          response.resume();
          resolve(get(next, redirects + 1));
          return;
        }
        if (status !== 200) {
          reject(new Error(`The page returned HTTP ${status}.`));
          return;
        }
        let data = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          data += chunk;
          // Hard cap so a huge page can't blow up memory.
          if (data.length > 5_000_000) {
            request.destroy();
            resolve(data);
          }
        });
        response.on('end', () => resolve(data));
        response.on('error', reject);
      });
      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('The page took too long to respond.'));
      });
    });

  return get(targetUrl);
}

/** Reduce raw HTML to readable text, preserving rows/structure for the LLM. */
function htmlToText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

  const text = html
    // Drop the noisy bits entirely.
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    // Turn row/cell/list boundaries into separators so events stay on their own lines.
    .replace(/<\/(tr|li|div|p|h[1-6]|article|section)>/gi, '\n')
    .replace(/<\/(td|th|span)>/gi, ' | ')
    .replace(/<br\s*\/?>/gi, '\n')
    // Strip remaining tags + decode the few entities that matter.
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&[a-z]+;/gi, ' ')
    // Collapse whitespace but keep newlines.
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();

  return { title, text: text.slice(0, MAX_TEXT_CHARS) };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = (req.body?.url || '').toString().trim();
  if (!url) {
    return res.status(400).json({ error: 'Missing "url" in request body.' });
  }
  let normalizedUrl = url;
  if (!/^https?:\/\//i.test(normalizedUrl)) normalizedUrl = `https://${normalizedUrl}`;
  try {
    // eslint-disable-next-line no-new
    new URL(normalizedUrl);
  } catch {
    return res.status(400).json({ error: 'That doesn’t look like a valid link.' });
  }

  try {
    const html = await fetchHtml(normalizedUrl);
    const { title, text } = htmlToText(html);

    if (!text || text.length < 40) {
      return res.status(422).json({ error: 'Couldn’t read anything useful from that page.' });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ title, text });
  } catch (err: any) {
    console.error('[schedule-scrape] fetch failed', normalizedUrl, err?.message);
    return res.status(500).json({ error: err?.message || 'Failed to read that link.' });
  }
}
