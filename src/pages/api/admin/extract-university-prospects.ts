import type { NextApiRequest, NextApiResponse } from 'next';

type ProgramSize =
  | '0-5000'
  | '5000 - 10000'
  | '10000 - 15,000'
  | '15000 - 25000'
  | '25000 - 50000'
  | '50000 - 100000'
  | '100000+';

type UniversityProspectShape = {
  university?: string;
  sport?: string;
  decisionMaker?: string;
  title?: string;
  email?: string;
  programSize?: ProgramSize;
  notes?: string;
};

const sizeMap = (raw: string | undefined): ProgramSize | undefined => {
  if (!raw) return undefined;
  const s = raw.replace(/[,\s]/g, '').replace(/–|—/g, '-').toLowerCase();
  if (/^0-?5000$/.test(s)) return '0-5000';
  if (/^5000-?10000$/.test(s)) return '5000 - 10000';
  if (/^10000-?15000$/.test(s)) return '10000 - 15,000';
  if (/^15000-?25000$/.test(s)) return '15000 - 25000';
  if (/^25000-?50000$/.test(s)) return '25000 - 50000';
  if (/^50000-?100000$/.test(s)) return '50000 - 100000';
  if (/^100000\+?$/.test(s)) return '100000+';
  return undefined;
};

const tryParseMarkdownTable = (text: string): UniversityProspectShape[] | null => {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const tableStart = lines.findIndex(l => /\|.+\|/.test(l));
  if (tableStart < 0) return null;
  const header = lines[tableStart];
  const sep = lines[tableStart + 1] || '';
  if (!/\|\s*-{2,}/.test(sep)) return null;
  const headers = header.split('|').map(h => h.trim().toLowerCase());
  const rows: UniversityProspectShape[] = [];
  for (let i = tableStart + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!/\|.+\|/.test(line)) continue;
    const cells = line.split('|').map(c => c.trim());
    if (cells.length !== headers.length) continue;
    const row: any = {};
    headers.forEach((h, idx) => { row[h] = cells[idx]; });

    const emailCell = (row['email'] || '') as string;
    const emailMatch = emailCell.match(/\((mailto:)?([^\)]+)\)/);
    const email = emailMatch ? emailMatch[2] : emailCell.replace(/^mailto:/i, '');

    const prospect: UniversityProspectShape = {
      university: row['university'] || undefined,
      decisionMaker: (row['decision maker'] || '').replace(/\*\*/g, '') || undefined,
      title: row['title'] || undefined,
      email: email || undefined,
      programSize: sizeMap(row['size range'] || row['student body range'] || row['approx. enrollment']) || undefined,
      sport: (row['target sport(s)'] || row['sport'] || '').replace(/\.$/, '') || undefined,
      notes: row['approx. enrollment'] ? `Approx Enrollment: ${row['approx. enrollment']}` : undefined
    };
    rows.push(prospect);
  }
  return rows.length ? rows : null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { text } = req.body || {};
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text is required' });

  const tableParsed = tryParseMarkdownTable(text);
  if (tableParsed && tableParsed.length) {
    return res.status(200).json({ success: true, prospects: tableParsed, parser: 'markdown' });
  }

  const apiKey = process.env.OPEN_AI_SECRET_KEY;
  const key = process.env.OPEN_AI_SECRET_KEY;
  const useKey = key || apiKey;
  if (!useKey) {
    return res.status(200).json({ success: true, prospects: [], parser: 'none', warning: 'No OPEN_AI_SECRET_KEY; only markdown tables supported' });
  }

  try {
    const system = `You convert pasted text (tables or freeform) into JSON university outreach prospects.
Return an array of items with these optional fields only:
- university, sport, decisionMaker, title, email, programSize, notes
- programSize must be one of: "0-5000", "5000 - 10000", "10000 - 15,000", "15000 - 25000", "25000 - 50000", "50000 - 100000", "100000+".
Rules:
- Extract emails as plain addresses (no mailto wrapper).
- For programSize, normalize any numeric range into the closest option above.
- sport should be concise (e.g., "Basketball", "Track & Field", "Swimming & Diving").
- Do not invent data.`;

    const userContent = `INPUT\n${text}\n\nOUTPUT: JSON only with an array under key prospects.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${useKey}`
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
    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }
    if (!parsed || !Array.isArray(parsed.prospects)) {
      return res.status(200).json({ success: true, prospects: [], parser: 'llm', warning: 'No prospects detected' });
    }

    const prospects: UniversityProspectShape[] = parsed.prospects.map((p: any) => ({
      university: p.university || undefined,
      sport: p.sport || undefined,
      decisionMaker: p.decisionMaker || p.name || undefined,
      title: p.title || undefined,
      email: typeof p.email === 'string' ? p.email.replace(/^mailto:/i, '') : undefined,
      programSize: sizeMap(p.programSize) || undefined,
      notes: p.notes || undefined
    }));

    return res.status(200).json({ success: true, prospects, parser: 'llm' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Unexpected error' });
  }
}
