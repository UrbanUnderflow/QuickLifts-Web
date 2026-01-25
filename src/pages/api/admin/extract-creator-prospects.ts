import type { NextApiRequest, NextApiResponse } from 'next';

// Minimal shape we need on the client
type CreatorProspectShape = {
  displayName?: string;
  handle?: string;
  email?: string;
  niche?: string;
  country?: string;
  ethnicity?: string;
  modality?: string;
  platforms?: {
    instagram?: string;
    youtube?: string;
    tiktok?: string;
    twitter?: string;
  };
  followers?: {
    instagram?: number;
    youtube?: number;
    tiktok?: number;
    twitter?: number;
  };
  engagement?: {
    engagementRate?: number;
    avgViews?: number;
    avgLikes?: number;
    avgComments?: number;
  };
  notes?: string;
};

const tryParseMarkdownTable = (text: string): CreatorProspectShape[] | null => {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const tableStart = lines.findIndex(l => /\|.+\|/.test(l));
  if (tableStart < 0) return null;
  // Expect header, separator, and rows
  const header = lines[tableStart];
  const sep = lines[tableStart + 1] || '';
  if (!/\|\s*-{2,}/.test(sep)) return null;
  const headers = header.split('|').map(h => h.trim().toLowerCase());
  const rows: CreatorProspectShape[] = [];
  for (let i = tableStart + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!/\|.+\|/.test(line)) continue;
    const cells = line.split('|').map(c => c.trim());
    if (cells.length !== headers.length) continue;
    const row: any = {};
    headers.forEach((h, idx) => {
      const val = cells[idx];
      row[h] = val;
    });
    // Map common columns heuristically
    const prospect: CreatorProspectShape = {
      displayName: row['decision maker'] || row['name'] || row['creator'] || row['coach'] || row['person'] || row['university'] || undefined,
      email: (row['email'] || '').replace(/\[(mailto:)?|\]|\(mailto:[^)]+\)/g, '').replace(/<|>/g, '').replace(/\((mailto:)?[^)]+\)/, ''),
      niche: row['target sport(s)'] || row['niche'] || undefined,
      country: undefined,
      notes: [row['title'], row['university'], row['size range'], row['approx. enrollment']].filter(Boolean).join(' • ') || undefined
    };
    if (prospect.email && /\((mailto:)?[^)]+\)/.test(row['email'] || '')) {
      const m = (row['email'] as string).match(/\((mailto:)?([^\)]+)\)/);
      if (m && m[2]) prospect.email = m[2];
    }
    rows.push(prospect);
  }
  return rows.length ? rows : null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { text } = req.body || {};
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text is required' });

  // First attempt a local markdown-table parser for speed/cost
  const tableParsed = tryParseMarkdownTable(text);
  if (tableParsed && tableParsed.length) {
    return res.status(200).json({ success: true, prospects: tableParsed, parser: 'markdown' });
  }

  const apiKey = process.env.OPEN_AI_SECRET_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPEN_AI_SECRET_KEY not configured' });
  }

  try {
    const system = `You convert pasted text (tables, lists, freeform) into JSON creator prospects.
Return an array of items with these optional fields only:
- displayName, handle, email, niche, country, ethnicity, modality
- platforms { instagram, youtube, tiktok, twitter }
- followers { instagram, youtube, tiktok, twitter } (numbers only)
- engagement { engagementRate, avgViews, avgLikes, avgComments } (numbers only)
- notes (string)
Rules:
- Extract emails as plain addresses (no mailto wrapper).
- Extract social handles/links when present.
- Keep language plain; do not invent data.
- If an item is not a creator, still map contact as displayName and keep source context in notes.
- Do not exceed 50 items.`;

    const userContent = `INPUT\n${text}\n\nOUTPUT: JSON only with an array under key prospects.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent }
        ],
        temperature: 0.2,
        max_tokens: 1200
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: `OpenAI request failed: ${err}` });
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content || '';
    // Try to parse JSON inside the content
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      }
    }
    if (!parsed || !Array.isArray(parsed.prospects)) {
      return res.status(200).json({ success: true, prospects: [], parser: 'llm', warning: 'No prospects detected' });
    }
    // Basic sanitization
    const prospects: CreatorProspectShape[] = parsed.prospects.map((p: any) => ({
      displayName: p.displayName || p.name || undefined,
      handle: p.handle || undefined,
      email: typeof p.email === 'string' ? p.email.replace(/^mailto:/i, '') : undefined,
      niche: p.niche || undefined,
      country: p.country || undefined,
      ethnicity: p.ethnicity || undefined,
      modality: p.modality || undefined,
      platforms: p.platforms || undefined,
      followers: p.followers || undefined,
      engagement: p.engagement || undefined,
      notes: p.notes || undefined,
    }));

    return res.status(200).json({ success: true, prospects, parser: 'llm' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Unexpected error' });
  }
}
