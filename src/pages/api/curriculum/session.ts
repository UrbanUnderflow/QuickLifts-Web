import { createHash } from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { authorizeLinearAthlete } from './runtime';
import { linearCollection, linearRuntimeEnabled } from '../../../api/firebase/dailyCurriculum/linearRuntimeAdmin';

export interface LinearPhaseSession {
  plan: string;
  returned: boolean;
  observation: string;
  revision: number;
  updatedAt: number | null;
}
const emptySession = (): LinearPhaseSession => ({ plan: '', returned: false, observation: '', revision: 0, updatedAt: null });
const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);

/** Private skill-phase work, separate from qualifying completion and private journal entries.
 * Assignment-derived identity protects a plan across daily assignment renewal and curriculum reorder.
 * Revision checks prevent another device or stale retry from silently overwriting newer writing.
 */
export const createLinearSessionHandler = (deps: {
  authorize?: typeof authorizeLinearAthlete;
  enabled?: () => boolean;
  now?: () => number;
} = {}) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method || '')) return res.status(405).json({ error: 'Method not allowed' });
  if (!(deps.enabled || linearRuntimeEnabled)()) return res.status(409).json({ error: 'Versioned skill sessions are disabled.' });
  let identity;
  try { identity = await (deps.authorize || authorizeLinearAthlete)(req); }
  catch { return res.status(401).json({ error: 'Sign in to open your skill plan.' }); }
  const assignmentId = req.method === 'GET' ? req.query.assignmentId : req.body?.assignmentId;
  if (!validId(assignmentId)) return res.status(400).json({ error: 'Choose a valid assignment.' });
  const { plan, returned, observation, expectedRevision } = req.body || {};
  if (req.method === 'POST' && (
    typeof plan !== 'string' || plan.length > 2000 ||
    typeof observation !== 'string' || observation.length > 4000 ||
    typeof returned !== 'boolean' || (returned && !plan.trim()) ||
    !Number.isSafeInteger(expectedRevision) || expectedRevision < 0
  )) return res.status(400).json({ error: 'Provide a plan of at most 2,000 characters, an observation of at most 4,000 characters, and the loaded revision.' });
  try {
    const stateRef = linearCollection(identity.db, 'states').doc(identity.uid);
    const result = await identity.db.runTransaction(async tx => {
      const [stateDoc, assignmentDoc] = await Promise.all([
        tx.get(stateRef), tx.get(stateRef.collection('assignments').doc(assignmentId)),
      ]);
      const state = stateDoc.data();
      const assignment = assignmentDoc.data();
      if (!stateDoc.exists || state?.athleteId !== identity.uid || state?.optedIn !== true ||
        !assignmentDoc.exists || assignment?.athleteId !== identity.uid || assignment?.phase !== 'use_it' ||
        !validId(assignment?.versionId) || !validId(assignment?.skillId) ||
        typeof assignment?.windowStart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(assignment.windowStart)) {
        return { kind: 'unavailable' as const };
      }
      const sessionId = createHash('sha256').update(JSON.stringify([
        assignment.versionId, assignment.skillId, assignment.phase, assignment.windowStart,
      ])).digest('hex');
      const sessions = stateRef.collection('phaseSessions');
      // Old clients keyed plans by restart window. Reuse the newest plan without
      // copying, merging or deleting private writing when that boundary changes.
      const history = await tx.get(sessions.limit(1001));
      if (history.size > 1000) throw new Error('Phase session history requires review');
      const candidates = history.docs.filter(doc => {
        const value = doc.data();
        return value.athleteId === identity.uid && value.versionId === assignment.versionId &&
          value.skillId === assignment.skillId && value.phase === assignment.phase;
      });
      if (candidates.some(doc => {
        const value = doc.data();
        return !Number.isSafeInteger(value.revision) || value.revision < 1 ||
          !Number.isFinite(value.updatedAt) || typeof value.plan !== 'string' ||
          typeof value.observation !== 'string' || typeof value.returned !== 'boolean';
      })) throw new Error('Phase session history requires review');
      candidates.sort((a, b) => b.data().updatedAt - a.data().updatedAt || a.id.localeCompare(b.id));
      const existing = candidates[0];
      const ref = existing?.ref || sessions.doc(sessionId);
      // A revision token spanning old windows detects a concurrent edit even if
      // two different historical plans have the same individual revision number.
      const revision = candidates.reduce((total, doc) => total + doc.data().revision, 0);
      if (!Number.isSafeInteger(revision + 1)) throw new Error('Phase session revision requires review');
      const storedRevision = existing?.data().revision || 0;
      const session: LinearPhaseSession = existing ? {
        plan: existing.data().plan, returned: existing.data().returned,
        observation: existing.data().observation, revision,
        updatedAt: existing.data().updatedAt,
      } : emptySession();
      if (req.method === 'GET') return { kind: 'loaded' as const, session };
      const next = { plan: plan.trim(), returned, observation: observation.trim() };
      // Identical retry is safe even when the original success response was lost.
      if (session.plan === next.plan && session.returned === next.returned && session.observation === next.observation) {
        return { kind: 'saved' as const, session };
      }
      if (session.revision !== expectedRevision) return { kind: 'conflict' as const, session };
      const updated: LinearPhaseSession = { ...next, revision: session.revision + 1, updatedAt: (deps.now || Date.now)() };
      const record = { ...updated, revision: storedRevision + 1, athleteId: identity.uid, assignmentId, versionId: assignment.versionId,
        skillId: assignment.skillId, phase: assignment.phase, windowStart: existing?.data().windowStart || assignment.windowStart };
      tx.create(ref.collection('revisions').doc(String(storedRevision + 1)), record);
      tx.set(ref, record);
      return { kind: 'saved' as const, session: updated };
    });
    if (result.kind === 'unavailable') return res.status(404).json({ error: 'This skill plan is unavailable for this account.' });
    if (result.kind === 'conflict') return res.status(409).json({ status: 'conflict', error: 'This plan changed on another device. Keep your draft and review the saved version before retrying.', session: result.session });
    return res.status(200).json({ status: result.kind, session: result.session });
  } catch {
    return res.status(503).json({ error: 'Your skill plan could not be saved. Keep your draft and retry.' });
  }
};

export default createLinearSessionHandler();
