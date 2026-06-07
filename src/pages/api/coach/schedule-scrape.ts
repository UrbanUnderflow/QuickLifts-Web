import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

/**
 * Coach Schedule Scraper
 * ------------------------------------------------------------------
 * Takes a published schedule URL (e.g. an athletics site's competition
 * schedule) and returns a clean, structured list of events that the
 * Schedule tab animates into the coach's calendar.
 *
 * POST /api/coach/schedule-scrape  { url: string }
 *   -> { sourceTitle: string, events: ScheduleEventDraft[] }
 *
 * Two steps:
 *   1) Fetch the page HTML (server-side, no CORS) and reduce it to
 *      readable text — schedules are almost always in tables/lists.
 *   2) Hand that text to gpt-4o-mini with a strict JSON schema and let
 *      it normalize dates, opponents, times, and locations.
 */

type ScrapedEvent = {
  title: string;
  date: string; // YYYY-MM-DD
  endDate?: string;
  time?: string;
  location?: string;
  opponent?: string;
  type: 'practice' | 'meeting' | 'lift' | 'competition' | 'travel' | 'event';
  notes?: string;
};

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

const SYSTEM_PROMPT = `You extract a sports/team schedule from the text of a web page.

Return STRICT JSON only, no markdown, in this exact shape:
{
  "sourceTitle": "<a short name for this schedule, e.g. 'Men's Track & Field 2026'>",
  "events": [
    {
      "title": "<short label — for competitions use 'vs. <Opponent>' or the meet name>",
      "date": "<YYYY-MM-DD>",
      "endDate": "<YYYY-MM-DD, only if the event spans multiple days, else omit>",
      "time": "<e.g. '3:30 PM', 'All Day', or 'TBA' — omit if unknown>",
      "location": "<city/venue if shown, else omit>",
      "opponent": "<opponent or host for competitions, else omit>",
      "type": "competition | practice | meeting | lift | travel | event",
      "notes": "<anything useful like 'Home', 'Away', 'Conference', else omit>"
    }
  ]
}

Rules:
- Only include real scheduled events you can see in the text. Never invent events, dates, or opponents.
- Resolve dates to full YYYY-MM-DD. If the page shows a year context, use it; otherwise infer the season's year from surrounding text. If a date is genuinely ambiguous, omit that event.
- Most items on an athletics schedule page are competitions; classify accordingly.
- Keep titles tight. Prefer 'vs. Florida State' over a long sentence.
- If you find no events, return an empty "events" array.`;

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

  const apiKey = process.env.OPEN_AI_SECRET_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Schedule import is not configured (missing API key).' });
  }

  try {
    const html = await fetchHtml(normalizedUrl);
    const { title, text } = htmlToText(html);

    if (!text || text.length < 40) {
      return res.status(422).json({ error: 'Couldn’t read anything useful from that page.' });
    }

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Page title: ${title || '(none)'}\nURL: ${normalizedUrl}\n\nPAGE TEXT:\n${text}`,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    let parsed: { sourceTitle?: string; events?: ScrapedEvent[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: 'Nora couldn’t make sense of that schedule.' });
    }

    const ISO = /^\d{4}-\d{2}-\d{2}$/;
    const events = (Array.isArray(parsed.events) ? parsed.events : [])
      .filter((e) => e && typeof e.title === 'string' && ISO.test(String(e.date)))
      .map((e) => ({
        title: String(e.title).trim().slice(0, 140),
        date: e.date,
        endDate: ISO.test(String(e.endDate)) ? e.endDate : undefined,
        time: e.time ? String(e.time).trim().slice(0, 40) : undefined,
        location: e.location ? String(e.location).trim().slice(0, 120) : undefined,
        opponent: e.opponent ? String(e.opponent).trim().slice(0, 120) : undefined,
        type: e.type,
        notes: e.notes ? String(e.notes).trim().slice(0, 200) : undefined,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return res.status(200).json({
      sourceTitle: (parsed.sourceTitle || title || 'Imported schedule').toString().trim().slice(0, 120),
      events,
    });
  } catch (err: any) {
    console.error('[schedule-scrape] failed', normalizedUrl, err?.message);
    return res.status(500).json({ error: err?.message || 'Failed to import that schedule.' });
  }
}
