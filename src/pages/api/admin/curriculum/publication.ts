import type { firestore } from 'firebase-admin';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createHash, randomUUID } from 'node:crypto';
import { buildLinearCurriculumCatalog, validateLinearOrder, type LinearCatalogRecords } from '../../../../api/firebase/dailyCurriculum/linearCurriculum';
import { buildLinearVersion, validateLinearPublication, type LinearPublicationDraft } from '../../../../api/firebase/dailyCurriculum/linearPublication';
import { CurriculumApiError, requireCurriculumAdmin, type CurriculumAdminIdentity } from './_auth';

export const config = { api: { bodyParser: { sizeLimit: '256kb' } } };
const ROOT = 'pulsecheck-linear-curriculum';
const catalogNames = ['pulsecheck-protocols', 'sim-modules', 'mental-exercises', 'sim-variants', 'pulsecheck-protocol-variants'];
const safeId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(value);
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => [key, canonical(val)])) : value;
export const linearReviewFingerprint = (draft: unknown, catalogFingerprint: string) => createHash('sha256').update(JSON.stringify(canonical({ draft, catalogFingerprint }))).digest('hex');
export interface SharedLinearDraft { id: string; revision: number; draft: LinearPublicationDraft; catalogFingerprint: string; updatedAt: string; updatedBy: string }
const parseDraft = (value: unknown): LinearPublicationDraft => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CurriculumApiError(400, 'invalid_draft', 'A curriculum draft is required.');
  const d = value as LinearPublicationDraft;
  if (!Array.isArray(d.orderedIds) || d.orderedIds.some(id => typeof id !== 'string') || !d.rationales || typeof d.rationales !== 'object' || Array.isArray(d.rationales) || Object.entries(d.rationales).some(([id, note]) => !d.orderedIds.includes(id) || typeof note !== 'string' || note.length > 4000)) throw new CurriculumApiError(400, 'invalid_draft', 'Skill order and text rationales are required.');
  return JSON.parse(JSON.stringify({ orderedIds: d.orderedIds, rationales: d.rationales, audience: d.audience ?? null, progressionBasis: d.progressionBasis ?? null, protocolDays: d.protocolDays ?? [5, 5, 5], simulationDays: d.simulationDays ?? null, ...(d.phaseProposal === undefined ? {} : { phaseProposal: d.phaseProposal }) })) as LinearPublicationDraft;
};
export const createLinearPublicationHandler = (dependencies: { authorize?: (req: NextApiRequest) => Promise<CurriculumAdminIdentity>; writesEnabled?: () => boolean; now?: () => string; id?: () => string } = {}) => async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'method_not_allowed' }); }
  try {
    const identity = await (dependencies.authorize || requireCurriculumAdmin)(req);
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const action = body?.action;
    if (!['review', 'save_draft', 'publish'].includes(action)) throw new CurriculumApiError(400, 'invalid_action', 'Choose review, save_draft or publish.');
    if (action !== 'review' && !(dependencies.writesEnabled || (() => process.env.LINEAR_CURRICULUM_PUBLISH_ENABLED === 'true'))()) throw new CurriculumApiError(409, 'publishing_disabled', 'Shared curriculum writes are disabled. Review remains available.');
    const db = identity.db;
    const snapshots = await Promise.all(catalogNames.map(name => db.collection(name).get()));
    const records: LinearCatalogRecords = {};
    snapshots.forEach((snap, index) => { records[catalogNames[index]] = snap.docs.map(doc => ({ ...doc.data(), id: doc.id })); });
    const catalog = { ...buildLinearCurriculumCatalog(records), fingerprint: linearReviewFingerprint(records, 'full-content-v1') };
    if (body.expectedCatalogFingerprint !== undefined && body.expectedCatalogFingerprint !== catalog.fingerprint) throw new CurriculumApiError(409, 'catalog_changed', 'The catalog changed. Review the current library again.');
    if (action !== 'review' && body.expectedCatalogFingerprint !== catalog.fingerprint) throw new CurriculumApiError(409, 'catalog_review_required', 'The reviewed catalog fingerprint is required.');
    const assertCatalogCurrent = async (tx: firestore.Transaction) => {
      const currentSnapshots = await Promise.all(catalogNames.map(name => tx.get(db.collection(name))));
      const currentRecords: LinearCatalogRecords = {};
      currentSnapshots.forEach((snap, index) => { currentRecords[catalogNames[index]] = snap.docs.map(doc => ({ ...doc.data(), id: doc.id })); });
      if (linearReviewFingerprint(currentRecords, 'full-content-v1') !== catalog.fingerprint) throw new CurriculumApiError(409, 'catalog_changed', 'The catalog changed during this request. Review it again.');
    };
    const draftId = body.draftId;
    if (draftId !== undefined && !safeId(draftId)) throw new CurriculumApiError(400, 'invalid_draft_id', 'Use a valid draft ID.');
    const ref = db.collection(ROOT).doc('drafts').collection('items').doc(draftId || (dependencies.id || randomUUID)());
    const stored = draftId ? await ref.get() : null;
    const saved = stored?.exists ? stored.data() as SharedLinearDraft : null;
    const draft = parseDraft(action === 'publish' ? saved?.draft : body.draft ?? saved?.draft);
    const orderErrors = validateLinearOrder(draft.orderedIds, catalog.active);
    if (orderErrors.length) throw new CurriculumApiError(400, 'invalid_order', orderErrors.join(' '));
    const review = validateLinearPublication(draft, catalog.active);
    const reviewFingerprint = linearReviewFingerprint(draft, catalog.fingerprint);
    if (action === 'review') return res.status(200).json({ draft, ...review, publishable: review.errors.length === 0, reviewFingerprint, catalogFingerprint: catalog.fingerprint, draftRevision: saved?.revision ?? null, activation: 'disabled', writesPerformed: false });
    if (action === 'publish' && (!saved || body.expectedDraftRevision !== saved.revision || body.expectedReviewFingerprint !== reviewFingerprint)) throw new CurriculumApiError(409, 'draft_changed', 'Review this saved draft revision before publishing.');
    if (action === 'publish' && review.errors.length) throw new CurriculumApiError(422, 'unresolved_decisions', review.errors.join(' '));
    const now = (dependencies.now || (() => new Date().toISOString()))();
    if (action === 'save_draft') {
      if (body.expectedDraftRevision !== (saved?.revision ?? null)) throw new CurriculumApiError(409, 'draft_changed', 'A newer draft exists. Reload before saving.');
      const next: SharedLinearDraft = { id: ref.id, revision: (saved?.revision || 0) + 1, draft, catalogFingerprint: catalog.fingerprint, updatedAt: now, updatedBy: identity.uid };
      await db.runTransaction(async tx => {
        await assertCatalogCurrent(tx);
        const current = await tx.get(ref);
        if ((current.exists ? current.data()?.revision : null) !== body.expectedDraftRevision) throw new CurriculumApiError(409, 'draft_changed', 'A newer draft exists. Reload before saving.');
        tx.set(ref, next);
      });
      return res.status(200).json({ draft: next, activation: 'disabled' });
    }
    const approved = body.runtimeReadySkillIds ?? [];
    if (!Array.isArray(approved) || approved.some((id: unknown) => typeof id !== 'string' || !draft.orderedIds.includes(id)) || (approved.length && body.confirmRuntimeReviewed !== true)) throw new CurriculumApiError(400, 'runtime_review_required', 'Explicit per-skill runtime review is required.');
    const contentSnapshots: Record<string, Record<string, unknown>> = {};
    for (const skill of catalog.active) {
      const source = skill.sourceRefs.find(ref => ref.startsWith('sim-modules/')) || skill.sourceRefs.find(ref => ref.startsWith('mental-exercises/'));
      if (source) { const [name, id] = source.split('/'); const asset = records[name]?.find(row => row.id === id); if (asset) contentSnapshots[skill.id] = asset; }
    }
    if (approved.some((id: string) => !contentSnapshots[id])) throw new CurriculumApiError(400, 'pinned_content_required', 'Runtime-approved skills require a compatible pinned content snapshot.');
    const version = buildLinearVersion({ id: (dependencies.id || randomUUID)(), publishedAt: now, draft, active: catalog.active, runtimeReadySkillIds: approved });
    const versionRef = db.collection(ROOT).doc('versions').collection('items').doc(version.id);
    await db.runTransaction(async tx => {
      await assertCatalogCurrent(tx);
      const current = await tx.get(ref);
      if (!current.exists || current.data()?.revision !== body.expectedDraftRevision || linearReviewFingerprint(current.data()?.draft, catalog.fingerprint) !== reviewFingerprint) throw new CurriculumApiError(409, 'draft_changed', 'The saved draft changed during publication.');
      for (const [skillId, contentSnapshot] of Object.entries(contentSnapshots)) tx.create(versionRef.collection('content').doc(skillId), { skillId, versionId: version.id, contentSnapshot });
      tx.create(versionRef, { ...version, contentSnapshotSkillIds: Object.keys(contentSnapshots), sourceDraftId: ref.id, sourceDraftRevision: saved!.revision, catalogFingerprint: catalog.fingerprint, reviewFingerprint, publishedBy: identity.uid, activation: 'disabled' });
    });
    return res.status(201).json({ versionId: version.id, status: 'published', activation: 'disabled', enrollmentWrites: 0, runtimeReadySkillIds: approved });
  } catch (err) {
    if (err instanceof CurriculumApiError) return res.status(err.statusCode).json({ error: err.code, message: err.message });
    if (err instanceof SyntaxError) return res.status(400).json({ error: 'invalid_json' });
    return res.status(500).json({ error: 'curriculum_request_failed', message: 'The curriculum request could not be completed.' });
  }
};
export default createLinearPublicationHandler();
