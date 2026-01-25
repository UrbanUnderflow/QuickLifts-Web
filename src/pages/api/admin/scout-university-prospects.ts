import type { NextApiRequest, NextApiResponse } from 'next';

type ProgramSize =
  | '0-5000'
  | '5000 - 10000'
  | '10000 - 15,000'
  | '15000 - 25000'
  | '25000 - 50000'
  | '50000 - 100000'
  | '100000+';

interface ProspectOut {
  university: string;
  sport: string;
  decisionMaker: string;
  title: string;
  email: string;
  programSize: ProgramSize;
  notes?: string;
}

const PROGRAM_OPTS: ProgramSize[] = ['0-5000','5000 - 10000','10000 - 15,000','15000 - 25000','25000 - 50000','50000 - 100000','100000+'];

const normalizeProgramSize = (val?: string): ProgramSize => {
  const s = (val || '').toLowerCase();
  for (const opt of PROGRAM_OPTS) {
    const key = opt.toLowerCase().replace(/[,\s]/g, '');
    if (s.replace(/[,\s]/g, '').includes(key.replace(/[,\s]/g, ''))) return opt as ProgramSize;
  }
  // heuristic by numeric
  if (/(^|[^\d])\d{1,2}k(\b|[^\d])/.test(s) || /0-?5\s*000/.test(s)) return '0-5000';
  if (/5\s*000\D+10\s*000/.test(s)) return '5000 - 10000';
  if (/10\s*000\D+15\s*000/.test(s)) return '10000 - 15,000';
  if (/15\s*000\D+25\s*000/.test(s)) return '15000 - 25000';
  if (/25\s*000\D+50\s*000/.test(s)) return '25000 - 50000';
  if (/50\s*000\D+100\s*000/.test(s)) return '50000 - 100000';
  if (/100\s*000\+?/.test(s)) return '100000+';
  return '0-5000';
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = process.env.OPEN_AI_SECRET_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPEN_AI_SECRET_KEY not configured' });

  try {
    const { sports, limit, existing, debug } = (req.body || {}) as { sports?: string[]; limit?: number; existing?: { emails?: string[]; decisionMakers?: string[]; universities?: string[]; pairs?: string[] }; debug?: boolean };
    // Cap to a safe max to keep model outputs reliable
    const max = Math.min(Math.max(Number(limit) || 10, 1), 50);
    console.log('[Scout] Incoming request', { sports, limit, max, existingCounts: { emails: existing?.emails?.length || 0, decisionMakers: existing?.decisionMakers?.length || 0, universities: existing?.universities?.length || 0, pairs: existing?.pairs?.length || 0 } });
    const sportsList = Array.isArray(sports) && sports.length > 0
      ? sports.join(', ')
      : 'Basketball, Indoor Track & Field, Swimming & Diving';

    const system = 'You are a research assistant for finding university coach prospects with real emails. Always return strict JSON only and avoid duplicates.';

    const existingEmails = Array.isArray(existing?.emails) ? existing!.emails.slice(0, 2000) : [];
    const existingNames = Array.isArray(existing?.decisionMakers) ? existing!.decisionMakers.slice(0, 2000) : [];
    const existingUniversities = Array.isArray(existing?.universities) ? existing!.universities.slice(0, 2000) : [];
    const existingPairs = Array.isArray(existing?.pairs) ? existing!.pairs.slice(0, 4000) : [];

    const user = `Find up to ${max} coach prospects in the United States for these sports: ${sportsList}, across ALL college athletics associations (NCAA Division I, NCAA Division II, NCAA Division III, NAIA, NJCAA, and others). Do not limit to Division I only. Aim for a healthy mix across associations.
Respond in JSON object with one key "prospects": an array of objects with EXACT keys:
  university, sport, decisionMaker, title, email, programSize, notes (optional)
Constraints:
- programSize must be one of: 0-5000, 5000 - 10000, 10000 - 15,000, 15000 - 25000, 25000 - 50000, 50000 - 100000, 100000+
- Prefer head/associate head coaches or directors for the listed sports.
- Use a direct, likely-to-reach work email (avoid info@ or generic addresses).
- Remove any prospect whose email appears in this list (case-insensitive):
- Existing emails: ${JSON.stringify(existingEmails)}
- Avoid exact duplicates by excluding any record whose (decisionMaker + university) pair matches these pairs (case-insensitive):
- Existing name+university pairs: ${JSON.stringify(existingPairs)}
 - Strongly prefer universities not in this list: ${JSON.stringify(existingUniversities)}. If necessary, you may include a different coach at an existing university, but avoid this unless you cannot reach the target count.
 - Do NOT fabricate or guess emails. If you cannot find a confident, real staff email, SKIP that prospect.
 - It is acceptable to return FEWER than ${max} results rather than duplicating or guessing.
 - Include a brief notes string with a source URL if available (e.g., staff directory page).
- JSON only. No backticks, no prose.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.3,
        max_tokens: Math.min(4000, 180 * max),
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.warn('[Scout] OpenAI HTTP error', response.status, err);
      return res.status(response.status).json({ error: `OpenAI request failed: ${err}` });
    }

    const data = await response.json();
    let content = data?.choices?.[0]?.message?.content || '{}';
    console.log('[Scout] Raw model content length', content?.length || 0);
    let jsonObj: any = {};
    try { jsonObj = JSON.parse(content); } catch { jsonObj = {}; }
    let parsedArray: any[] = Array.isArray(jsonObj?.prospects) ? jsonObj.prospects : [];

    // Fallback: try to salvage JSON array if the model ignored response_format
    if (parsedArray.length === 0 && typeof content === 'string') {
      try {
        const arrMatch = content.match(/\[[\s\S]*\]/);
        if (arrMatch) parsedArray = JSON.parse(arrMatch[0]);
      } catch {}
    }

    if (!Array.isArray(parsedArray)) parsedArray = [];
    const metrics: any = { requested: max, returned: parsedArray.length };
    const normalizeEmail = (s: string) => (s || '').toLowerCase().trim();
    const normalizeName = (s: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const normalizeUniversity = (s: string) => (s || '').toLowerCase().trim();
    const makePair = (name: string, university: string) => `${normalizeName(name)}|${normalizeUniversity(university)}`;
    const existingEmailSet = new Set((existingEmails || []).map(normalizeEmail));
    const existingPairSet = new Set((existingPairs || []).map((k) => String(k).toLowerCase().trim()));

    const debugReport: any[] = [];
    let prospectsRaw: ProspectOut[] = parsedArray.map((raw: any) => ({
      university: String(raw?.university || '').trim(),
      sport: String(raw?.sport || '').trim(),
      decisionMaker: String(raw?.decisionMaker || '').trim(),
      title: String(raw?.title || '').trim(),
      email: String(raw?.email || '').trim(),
      programSize: normalizeProgramSize(String(raw?.programSize || '0-5000')),
      notes: String(raw?.notes || '').trim() || undefined,
    })).filter(p => p.university && p.decisionMaker && p.title);

    // Heuristic: detect suspicious repeated local-part emails across multiple universities (likely fabricated)
    const localPartToUniversities = new Map<string, Set<string>>();
    const getLocal = (email: string) => (email.includes('@') ? email.split('@')[0].toLowerCase() : '');
    for (const p of prospectsRaw) {
      const lp = getLocal(p.email || '');
      const uni = (p.university || '').toLowerCase().trim();
      if (!lp || !uni) continue;
      if (!localPartToUniversities.has(lp)) localPartToUniversities.set(lp, new Set());
      localPartToUniversities.get(lp)!.add(uni);
    }

    // First pass against existing sets with reasons
    const survivors: ProspectOut[] = [];
    for (const p of prospectsRaw) {
      const e = normalizeEmail(p.email);
      const n = normalizeName(p.decisionMaker);
      const u = normalizeUniversity(p.university);
      const pairKey = makePair(n, u);
      const lp = getLocal(e);
      const uniCount = localPartToUniversities.get(lp)?.size || 0;
      if (lp && uniCount >= 3) { debugReport.push({ stage: 'existing', reason: 'suspiciousLocalPart', detail: { lp, uniCount }, p }); metrics.suspiciousLocalPart = (metrics.suspiciousLocalPart || 0) + 1; continue; }
      if (!e) { debugReport.push({ stage: 'existing', reason: 'missingEmail', p }); metrics.missingEmail = (metrics.missingEmail || 0) + 1; continue; }
      if (existingEmailSet.has(e)) { debugReport.push({ stage: 'existing', reason: 'dupByEmail', p }); metrics.dupByEmail = (metrics.dupByEmail || 0) + 1; continue; }
      if (existingPairSet.has(pairKey)) { debugReport.push({ stage: 'existing', reason: 'dupByPair', p }); metrics.dupByPair = (metrics.dupByPair || 0) + 1; continue; }
      debugReport.push({ stage: 'existing', reason: 'ok', p });
      survivors.push(p);
    }

    // Batch de-dup survivors with reasons
    let prospects: ProspectOut[] = [];
    const seenEmails = new Set<string>();
    const seenPairs = new Set<string>();
    for (const p of survivors) {
      const e = normalizeEmail(p.email);
      const n = normalizeName(p.decisionMaker);
      const u = normalizeUniversity(p.university);
      const pairKey = makePair(n, u);
      if (seenEmails.has(e)) { debugReport.push({ stage: 'batch', reason: 'batchDupEmail', p }); metrics.batchDupEmail = (metrics.batchDupEmail || 0) + 1; continue; }
      if (seenPairs.has(pairKey)) { debugReport.push({ stage: 'batch', reason: 'batchDupPair', p }); metrics.batchDupPair = (metrics.batchDupPair || 0) + 1; continue; }
      seenEmails.add(e); seenPairs.add(pairKey);
      debugReport.push({ stage: 'batch', reason: 'kept', p });
      prospects.push(p);
    }
    metrics.afterFilter = prospects.length;

    // Fallback: if we filtered out everything, relax the university filter and try again
    if (prospects.length === 0 && parsedArray.length > 0) {
      console.warn('[Scout] All filtered out; relaxing university constraint.');
      const tmp = parsedArray.map((raw: any) => ({
        university: String(raw?.university || '').trim(),
        sport: String(raw?.sport || '').trim(),
        decisionMaker: String(raw?.decisionMaker || '').trim(),
        title: String(raw?.title || '').trim(),
        email: String(raw?.email || '').trim(),
        programSize: normalizeProgramSize(String(raw?.programSize || '0-5000')),
        notes: String(raw?.notes || '').trim() || undefined,
      }));
      const survivorsRelax: ProspectOut[] = [];
      for (const p of tmp) {
        const e = normalizeEmail(p.email);
        const n = normalizeName(p.decisionMaker);
        const u = normalizeUniversity(p.university);
        const pairKey = makePair(n, u);
        const lp = getLocal(e);
        const uniCount = localPartToUniversities.get(lp)?.size || 0;
        if (lp && uniCount >= 3) { debugReport.push({ stage: 'relaxedExisting', reason: 'suspiciousLocalPart', detail: { lp, uniCount }, p }); continue; }
        if (!e) { debugReport.push({ stage: 'relaxedExisting', reason: 'missingEmail', p }); continue; }
        if (existingEmailSet.has(e)) { debugReport.push({ stage: 'relaxedExisting', reason: 'dupByEmail', p }); continue; }
        if (existingPairSet.has(pairKey)) { debugReport.push({ stage: 'relaxedExisting', reason: 'dupByPair', p }); continue; }
        debugReport.push({ stage: 'relaxedExisting', reason: 'ok', p });
        survivorsRelax.push(p);
      }
      // Batch de-dup relaxed survivors
      const seenEmailsR = new Set<string>();
      const seenPairsR = new Set<string>();
      prospects = [];
      for (const p of survivorsRelax) {
        const e = normalizeEmail(p.email);
        const n = normalizeName(p.decisionMaker);
        const u = normalizeUniversity(p.university);
        const pairKey = makePair(n, u);
        if (seenEmailsR.has(e)) { debugReport.push({ stage: 'relaxedBatch', reason: 'batchDupEmail', p }); continue; }
        if (seenPairsR.has(pairKey)) { debugReport.push({ stage: 'relaxedBatch', reason: 'batchDupPair', p }); continue; }
        seenEmailsR.add(e); seenPairsR.add(pairKey);
        debugReport.push({ stage: 'relaxedBatch', reason: 'kept', p });
        prospects.push(p);
      }
      metrics.afterRelaxed = prospects.length;
    }

    // Second-pass expansion: if still too few results, broaden to D2/D3/NAIA/NJCAA and require unseen universities
    let promptPreview2: string | undefined;
    let debugReport2: any[] | undefined;
    if (prospects.length < Math.min(5, max)) {
      metrics.secondPassRequested = true;
      const avoidUniversities = Array.from(new Set([
        ...(existingUniversities || []),
        ...((parsedArray || []).map((r: any) => String(r?.university || '').toLowerCase().trim()))
      ])).slice(0, 5000);
      const user2 = `Find up to ${max} coach prospects for these sports: ${sportsList}.
Respond in JSON with key "prospects" and EXACT keys: university, sport, decisionMaker, title, email, programSize, notes.
Rules:
- STRICT: Do not include any university in this list: ${JSON.stringify(avoidUniversities)}
- STRICT: Do not include any email in this list: ${JSON.stringify(existingEmails)}
- Focus on NCAA Division II, NCAA Division III, NAIA, and NJCAA programs.
- One coach per university. Prefer head/associate head coach or director for listed sports.
- Include a source URL in notes when possible. Do not guess emails; skip if unknown.
- It is acceptable to return fewer than ${max}.
JSON only.`;
      promptPreview2 = user2.slice(0, 2000);
      const resp2 = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [ { role: 'system', content: system }, { role: 'user', content: user2 } ],
          temperature: 0.2,
          max_tokens: Math.min(4000, 180 * max),
          response_format: { type: 'json_object' }
        })
      });
      if (resp2.ok) {
        const data2 = await resp2.json();
        let content2 = data2?.choices?.[0]?.message?.content || '{}';
        let obj2: any = {};
        try { obj2 = JSON.parse(content2); } catch {}
        let arr2: any[] = Array.isArray(obj2?.prospects) ? obj2.prospects : [];
        if (!Array.isArray(arr2)) arr2 = [];
        metrics.secondPassReturned = arr2.length;
        debugReport2 = [];
        // Map → filter using same rules
        let raw2: ProspectOut[] = arr2.map((raw: any) => ({
          university: String(raw?.university || '').trim(),
          sport: String(raw?.sport || '').trim(),
          decisionMaker: String(raw?.decisionMaker || '').trim(),
          title: String(raw?.title || '').trim(),
          email: String(raw?.email || '').trim(),
          programSize: normalizeProgramSize(String(raw?.programSize || '0-5000')),
          notes: String(raw?.notes || '').trim() || undefined,
        })).filter(p => p.university && p.decisionMaker && p.title);

        const survivors2: ProspectOut[] = [];
        for (const p of raw2) {
          const e = normalizeEmail(p.email);
          const n = normalizeName(p.decisionMaker);
          const u = normalizeUniversity(p.university);
          const pairKey = makePair(n, u);
          const lp = getLocal(e);
          const uniCount = 0; // not tracking second pass duplication across locals
          if (!e) { debugReport2.push({ stage: 'secondExisting', reason: 'missingEmail', p }); continue; }
          if (existingEmailSet.has(e)) { debugReport2.push({ stage: 'secondExisting', reason: 'dupByEmail', p }); continue; }
          if (existingPairSet.has(pairKey)) { debugReport2.push({ stage: 'secondExisting', reason: 'dupByPair', p }); continue; }
          // strictly skip avoided universities
          if (avoidUniversities.includes(u)) { debugReport2.push({ stage: 'secondExisting', reason: 'avoidUniversity', p }); continue; }
          debugReport2.push({ stage: 'secondExisting', reason: 'ok', p });
          survivors2.push(p);
        }
        const seenE2 = new Set<string>();
        const seenP2 = new Set<string>();
        const kept2: ProspectOut[] = [];
        for (const p of survivors2) {
          const e = normalizeEmail(p.email);
          const n = normalizeName(p.decisionMaker);
          const u = normalizeUniversity(p.university);
          const pairKey = makePair(n, u);
          if (seenE2.has(e)) { debugReport2.push({ stage: 'secondBatch', reason: 'batchDupEmail', p }); continue; }
          if (seenP2.has(pairKey)) { debugReport2.push({ stage: 'secondBatch', reason: 'batchDupPair', p }); continue; }
          seenE2.add(e); seenP2.add(pairKey);
          debugReport2.push({ stage: 'secondBatch', reason: 'kept', p });
          kept2.push(p);
        }
        metrics.secondPassAfterFilter = kept2.length;
        if (kept2.length > 0) prospects = kept2;
      } else {
        const err2 = await resp2.text();
        console.warn('[Scout] second pass error', resp2.status, err2);
      }
    }

    if (debug) {
      return res.status(200).json({ prospects, metrics, promptPreview: user.slice(0, 2000), promptPreview2, modelReturned: prospectsRaw, debugReport, debugReport2 });
    }
    return res.status(200).json({ prospects });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Unexpected error' });
  }
}


