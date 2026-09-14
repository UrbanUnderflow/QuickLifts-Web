import { createHash } from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { authorizeLinearAthlete } from './runtime';
import { commitLegacyStart } from '../../../api/firebase/dailyCurriculum/linearEnrollmentHandshake';
export const createLegacyStartHandler = (deps: { authorize?: typeof authorizeLinearAthlete; now?: () => number } = {}) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let identity;
  try { identity = await (deps.authorize || authorizeLinearAthlete)(req); } catch { return res.status(401).json({ error: 'Sign in before starting.' }); }
  const { collection, assignmentId, action, moduleId, idempotencyKey, outcome } = req.body || {};
  const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
  if (action === 'reserve' || action === 'release') {
    if (action === 'reserve' ? !validId(moduleId) || !validId(idempotencyKey) : !validId(assignmentId) || !validId(idempotencyKey) || !['completed', 'cancelled'].includes(outcome)) return res.status(400).json({ error: 'Choose a valid practice session.' });
    const id = `standalone_${createHash('sha256').update(`${identity.uid}:${idempotencyKey}`).digest('hex')}`;
    if (action === 'release' && assignmentId !== id) return res.status(409).json({ error: 'The session key does not match this activity.' });
    const ref = identity.db.collection('sim-assignments').doc(id);
    try {
      await identity.db.runTransaction(async tx => {
        const current = await tx.get(ref);
        const existing = current.data();
        if (existing && (existing.athleteUserId !== identity.uid || existing.source !== 'standalone_reservation')) throw Object.assign(new Error('This session belongs to another activity.'), { statusCode: 409 });
        if (action === 'release') {
          if (!existing) {
            if (outcome !== 'cancelled') throw Object.assign(new Error('Session not found.'), { statusCode: 409 });
            // A terminal record wins against an in-flight reserve of the same owner/key.
            // Never report cancellation without storing this barrier.
            const now = (deps.now || Date.now)();
            tx.create(ref, { athleteUserId: identity.uid, source: 'standalone_reservation', status: 'cancelled', requestKeyHash: id.slice('standalone_'.length), createdAt: now, updatedAt: now, endedAt: now });
            return;
          }
          if (existing.status === outcome) return;
          if (existing.status !== 'in_progress') throw Object.assign(new Error('This session has already ended.'), { statusCode: 409 });
          tx.update(ref, { status: outcome, endedAt: (deps.now || Date.now)(), updatedAt: (deps.now || Date.now)() });
          return;
        }
        if (existing && (existing.exerciseId !== moduleId || existing.status !== 'in_progress')) throw Object.assign(new Error('Use a new request key for a new practice attempt.'), { statusCode: 409 });
        const state = await tx.get(identity.db.collection('pulsecheck-linear-curriculum').doc('states').collection('items').doc(identity.uid));
        if (state.exists) throw Object.assign(new Error('Refresh your current skill journey before starting.'), { statusCode: 409 });
        const modules = await Promise.all(['sim-modules', 'mental-exercises'].map(name => tx.get(identity.db.collection(name).doc(moduleId))));
        if (modules.find(doc => doc.exists)?.data()?.isActive !== true) throw Object.assign(new Error('This module is unavailable.'), { statusCode: 409 });
        // Same canonical enrollment and operational-state fields used by pilot operations.
        // Read them in this transaction so a simultaneous restriction update retries the start.
        const enrollments = await tx.get(identity.db.collection('pulsecheck-pilot-enrollments').where('userId', '==', identity.uid).limit(101));
        if (enrollments.size > 100) throw Object.assign(new Error('Your access needs review before starting.'), { statusCode: 409 });
        for (const enrollment of enrollments.docs) {
          const operational = await tx.get(identity.db.collection('pulsecheck-pilot-operational-states').doc(enrollment.id));
          const data = operational.data() || {};
          const status = String(data.baseStatus || data.status || enrollment.data().status || '').toLowerCase();
          const flags = data.restrictionFlags || data.watchListRestrictionFlags || {};
          if (['paused', 'withdrawn'].includes(status) || (data.watchListActive === true && (flags.suppressAssignments !== false || flags.manualHold === true))) throw Object.assign(new Error('Practice is currently on hold.'), { statusCode: 409 });
        }
        if (!existing) {
          const now = (deps.now || Date.now)();
          tx.create(ref, { athleteUserId: identity.uid, exerciseId: moduleId, source: 'standalone_reservation', status: 'in_progress', startedAt: now, createdAt: now, updatedAt: now });
        }
      });
      return res.status(200).json({ status: 'recorded', assignmentId: id });
    } catch (error) { return res.status((error as { statusCode?: number }).statusCode || 503).json({ error: error instanceof Error ? error.message : 'Your session could not be saved.' }); }
  }
  if (!['mental-exercise-assignments', 'sim-assignments'].includes(collection) || typeof assignmentId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(assignmentId)) return res.status(400).json({ error: 'Choose a valid legacy assignment.' });
  try {
    await commitLegacyStart(identity.db, identity.db.collection(collection).doc(assignmentId), identity.uid, current => {
      if (['completed','skipped','expired','superseded','cancelled','canceled'].includes(String(current.status))) throw Object.assign(new Error('This assignment has ended. Refresh your current skill.'), { statusCode: 409 });
      return { status: 'in_progress', updatedAt: (deps.now || Date.now)() };
    });
    return res.status(200).json({ status: 'recorded' });
  } catch (error) { return res.status((error as { statusCode?: number }).statusCode || 503).json({ error: error instanceof Error ? error.message : 'Your assignment could not start.' }); }
};
export default createLegacyStartHandler();
