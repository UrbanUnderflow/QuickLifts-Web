import type { NextApiRequest, NextApiResponse } from 'next';
import { authorizeLinearAthlete } from '../curriculum/runtime';
import { EVIDENCE_COLLECTION, EvidenceError, evidenceEntries, isJournalType, journalTypeOf, parseEvidence, saveEvidence, validEvidenceId, withJournalType } from '../../../lib/evidence-journal';

// A type filter scans newest first in batches, because entries saved before types existed have no type field to query on.
const FILTER_BATCH = 50;
const FILTER_SCAN_LIMIT = 500;
// Screening runs in the journal-safety-screen function next to Nora chat, which owns the classifier and escalation
// code. The save waits this long for it; anything slower finishes in the scheduled sweep.
const SCREENING_BUDGET_MS = 9000;

type SafetyBlock = { status: string; escalationId?: string | null; handoff?: string };
export async function requestScreening(req: NextApiRequest, entryId: string): Promise<SafetyBlock> {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCREENING_BUDGET_MS);
  try {
    const response = await fetch(`${proto}://${host}/.netlify/functions/journal-safety-screen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: String(req.headers.authorization || ''),
        'x-pulsecheck-firebase-mode': String(req.headers['x-pulsecheck-firebase-mode'] || ''),
      },
      body: JSON.stringify({ entryId }),
      signal: controller.signal,
    });
    if (!response.ok) return { status: 'pending' };
    const payload = await response.json();
    return payload?.safety || { status: 'pending' };
  } catch {
    return { status: 'pending' };
  } finally {
    clearTimeout(timer);
  }
}

export const createEvidenceJournalHandler = (deps: { authorize?: typeof authorizeLinearAthlete; now?: () => number; screen?: typeof requestScreening } = {}) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST', 'DELETE'].includes(req.method || '')) return res.status(405).json({ error: 'Method not allowed' });
  let identity;
  try { identity = await (deps.authorize || authorizeLinearAthlete)(req); if (!identity.uid) throw Error(); }
  catch { return res.status(401).json({ error: 'Sign in to open your evidence.' }); }
  try {
    const entries = evidenceEntries(identity.db, identity.uid);
    if (req.method === 'POST') {
      const now = (deps.now || Date.now)();
      const input = parseEvidence(req.body);
      if ('photoStoragePath' in input && input.photoStoragePath && !input.photoStoragePath.startsWith(`pulsecheck-journal-photos/${identity.uid}/`)) {
        throw new EvidenceError(403, 'That photo belongs to another account.');
      }
      const result = await saveEvidence(identity.db, identity.uid, input, now);
      const entryId = String(result.entry.id);
      // Mark the screening pending before asking for it, so the sweep finishes it if this request never gets an answer.
      const screening = identity.db.collection(EVIDENCE_COLLECTION).doc(identity.uid).collection('screenings').doc(entryId);
      if (result.created) await screening.set({ status: 'pending', attempts: 0, createdAt: now }, { merge: true });
      const safety = await (deps.screen || requestScreening)(req, entryId);
      return res.status(200).json({ ...result, safety });
    }
    if (req.method === 'DELETE') {
      if (!validEvidenceId(req.query.entryId)) throw new EvidenceError(400, 'Choose a valid entry.');
      // Recursive deletion also removes private event deduplication records.
      await identity.db.recursiveDelete(entries.doc(req.query.entryId.toLowerCase()));
      return res.status(200).json({ deleted: true });
    }
    const rawLimit = req.query.limit;
    if (rawLimit !== undefined && (typeof rawLimit !== 'string' || !/^\d+$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 50)) throw new EvidenceError(400, 'Choose a page size between 1 and 50.');
    const limit = rawLimit === undefined ? 20 : Number(rawLimit);
    const rawType = req.query.type;
    if (rawType !== undefined && !isJournalType(rawType)) throw new EvidenceError(400, 'Choose a valid journal type.');
    let start: any = null;
    if (req.query.cursor !== undefined) {
      if (!validEvidenceId(req.query.cursor)) throw new EvidenceError(400, 'Invalid page cursor.');
      start = await entries.doc(req.query.cursor.toLowerCase()).get();
      if (!start.exists) throw new EvidenceError(400, 'That page changed. Refresh your evidence.');
    }
    const newestFirst = (size: number, after: any) => {
      const query = entries.orderBy('createdAt', 'desc').orderBy('__name__', 'desc').limit(size);
      return after ? query.startAfter(after) : query;
    };
    if (rawType === undefined) {
      const page = await newestFirst(limit + 1, start).get();
      const docs = page.docs.slice(0, limit);
      return res.status(200).json({ entries: docs.map(doc => withJournalType(doc.data())), nextCursor: page.docs.length > limit ? docs[docs.length - 1].id : null });
    }
    const matches: any[] = [];
    let scanned = 0, lastScanned: any = start, exhausted = false;
    while (matches.length <= limit && scanned < FILTER_SCAN_LIMIT) {
      const page = await newestFirst(FILTER_BATCH, lastScanned).get();
      for (const doc of page.docs) {
        scanned += 1; lastScanned = doc;
        if (journalTypeOf(doc.data()) === rawType) matches.push(doc);
        if (matches.length > limit) break;
      }
      if (page.docs.length < FILTER_BATCH) { exhausted = matches.length <= limit; break; }
    }
    const docs = matches.slice(0, limit);
    // More may remain when a match spilled past the page, or when the scan stopped before reaching the oldest entry.
    const nextCursor = matches.length > limit ? docs[docs.length - 1].id : (exhausted || !lastScanned ? null : lastScanned.id);
    return res.status(200).json({ entries: docs.map(doc => withJournalType(doc.data())), nextCursor });
  } catch (error) {
    return res.status(error instanceof EvidenceError ? error.status : 503).json({ error: error instanceof EvidenceError ? error.message : 'Your evidence is unavailable right now. Keep any draft and try again.' });
  }
};
export default createEvidenceJournalHandler();
