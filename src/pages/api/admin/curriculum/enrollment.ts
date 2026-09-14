import { prepareLegacyHandoff } from '../../../../api/firebase/dailyCurriculum/linearLegacyHandoff';
import { assertNoActiveLegacyWork } from '../../../../api/firebase/dailyCurriculum/linearEnrollmentHandshake';
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireCurriculumAdmin, CurriculumApiError, type CurriculumAdminIdentity } from './_auth';
import { linearCollection, linearLocalDate, linearRuntimeEnabled, type LinearRuntimeState } from '../../../../api/firebase/dailyCurriculum/linearRuntimeAdmin';
import type { LinearPublishedVersion } from '../../../../api/firebase/dailyCurriculum/linearPublication';
const safeId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export const createLinearEnrollmentHandler = (deps: { authorize?: typeof requireCurriculumAdmin; enabled?: () => boolean; now?: () => number } = {}) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const identity: CurriculumAdminIdentity = await (deps.authorize || requireCurriculumAdmin)(req);
    if (!(deps.enabled || linearRuntimeEnabled)()) throw new CurriculumApiError(409, 'runtime_disabled', 'Enrollment and release routing are disabled.');
    const body = req.body || {}; const now = (deps.now || Date.now)();
    if (!safeId(body.audienceId)) throw new CurriculumApiError(400, 'invalid_audience', 'Choose an explicit audience ID.');
    const audienceRef = linearCollection(identity.db, 'audiences').doc(body.audienceId);
    if (body.action === 'set_audience') {
      if (!safeId(body.versionId) || !Array.isArray(body.athleteIds) || body.athleteIds.length > 500 || !body.athleteIds.every(safeId)) throw new CurriculumApiError(400, 'invalid_audience', 'Choose a published version and an explicit list of at most 500 athlete IDs.');
      const result = await identity.db.runTransaction(async tx => {
        const [current, versionDoc] = await Promise.all([tx.get(audienceRef), tx.get(linearCollection(identity.db, 'versions').doc(body.versionId))]);
        if (!versionDoc.exists || versionDoc.data()?.status !== 'published') throw new CurriculumApiError(400, 'version_unavailable', 'A published version is required.');
        if ((current.exists ? current.data()?.revision : null) !== body.expectedRevision) throw new CurriculumApiError(409, 'audience_changed', 'Reload the current audience revision.');
        const next = { id: body.audienceId, versionId: body.versionId, athleteIds: [...new Set(body.athleteIds)], revision: (current.data()?.revision || 0) + 1, updatedAt: now, updatedBy: identity.uid };
        tx.set(audienceRef, next); return next;
      });
      return res.status(200).json({ audience: result, athleteWrites: 0 });
    }
    if (body.action !== 'enroll' || !safeId(body.athleteId) || body.confirmOptIn !== true || body.preserveHistory !== true || typeof body.timezone !== 'string') throw new CurriculumApiError(400, 'explicit_enrollment_required', 'Explicit athlete opt-in, timezone and preserved history are required.');
    let today: string;
    try { today = linearLocalDate(now, body.timezone); } catch { throw new CurriculumApiError(400, 'invalid_timezone', 'Choose a valid athlete timezone.'); }
    const stateRef = linearCollection(identity.db, 'states').doc(body.athleteId);
    const state = await identity.db.runTransaction(async tx => {
      const [current, audience, user] = await Promise.all([tx.get(stateRef), tx.get(audienceRef), tx.get(identity.db.collection('users').doc(body.athleteId))]);
      if (current.exists) {
        if (current.data()?.audienceId === body.audienceId && current.data()?.optedIn === true) return current.data() as LinearRuntimeState;
        throw new CurriculumApiError(409, 'already_enrolled', 'Existing skill progress cannot be replaced by enrollment.');
      }
      if (body.expectedStateRevision !== null) throw new CurriculumApiError(409, 'state_changed', 'Confirm that this athlete has no versioned enrollment.');
      if (!user.exists || !audience.exists || !audience.data()?.athleteIds?.includes(body.athleteId)) throw new CurriculumApiError(403, 'not_in_audience', 'This athlete is not in the explicit release audience.');
      const versionDoc = await tx.get(linearCollection(identity.db, 'versions').doc(audience.data()!.versionId));
      const version = versionDoc.data() as (LinearPublishedVersion & { contentSnapshots?: Record<string, unknown> }) | undefined;
      if (!version || version.status !== 'published' || version.content.progressionBasis !== 'five_days_in_fourteen') throw new CurriculumApiError(409, 'version_unavailable', 'A compatible published version is required.');
      const first = version.content.orderedIds[0];
      const pinnedAsset = first ? await tx.get(linearCollection(identity.db, 'versions').doc(version.id).collection('content').doc(first)) : null;
      if (first !== 'protocol-478-breathing' || !version.runtimeReadySkillIds.includes(first) || !(version.contentSnapshots?.[first] || pinnedAsset?.data()?.contentSnapshot)) throw new CurriculumApiError(409, 'runtime_unapproved', 'The selected version needs explicit runtime and pinned-content approval.');
      let handoff = {};
      try { if (body.reviewedLegacyHandoff !== undefined) handoff = await prepareLegacyHandoff(tx, identity.db, { review: body.reviewedLegacyHandoff, athleteId: body.athleteId, today, timezone: body.timezone, versionId: version.id, now }); else await assertNoActiveLegacyWork(tx, identity.db, body.athleteId); } catch (error) { throw new CurriculumApiError(409, 'legacy_review_required', error instanceof Error ? error.message : 'Review current legacy work before enrollment.'); }
      const next: LinearRuntimeState = { athleteId: body.athleteId, optedIn: true, audienceId: body.audienceId, revision: 1, enrollment: { athleteId: body.athleteId, versionId: version.id, optedIn: true, startedOn: today, timezone: body.timezone, historyPolicy: 'preserve' }, currentSkill: { skillId: first, versionId: version.id, startedOn: today }, completedSkillIds: [] };
      tx.create(stateRef, { ...next, ...handoff, enrolledBy: identity.uid, enrolledAt: now }); return { ...next, ...handoff };
    });
    return res.status(200).json({ state, legacyHistoryWrites: 0 });
  } catch (err) {
    if (err instanceof CurriculumApiError) return res.status(err.statusCode).json({ error: err.code, message: err.message });
    return res.status(503).json({ error: 'enrollment_unavailable', message: 'Enrollment could not be verified. No existing progress was replaced.' });
  }
};
export default createLinearEnrollmentHandler();
