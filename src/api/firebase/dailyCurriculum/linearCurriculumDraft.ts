import { collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../config';
import { buildLinearCurriculumCatalog, getLinearCurriculumSnapshot, LinearCatalogRecords, LinearCurriculumDraft, LINEAR_PHASE_PROPOSAL, parseLinearCurriculumDraft, validateLinearOrder } from './linearCurriculum';
import { isDevAuthBypassEnabled } from '../../../utils/devAuthBypass';

const storageKey = () => {
  if (isDevAuthBypassEnabled()) return 'pulse-linear-curriculum-v1:local-review';
  if (!auth.currentUser) throw new Error('Sign in before saving a curriculum draft.');
  return `pulse-linear-curriculum-v1:${db.app.options.projectId}:${auth.currentUser.uid}`;
};
export const loadLinearCurriculumCatalog = async () => {
  if (isDevAuthBypassEnabled()) return getLinearCurriculumSnapshot();
  const names = ['pulsecheck-protocols', 'sim-modules', 'mental-exercises', 'sim-variants', 'pulsecheck-protocol-variants'];
  const snapshots = await Promise.all(names.map(name => getDocs(collection(db, name))));
  const records: LinearCatalogRecords = {};
  snapshots.forEach((snap, index) => { records[names[index]] = snap.docs.map(d => ({ ...d.data(), id: d.id })); });
  return { ...buildLinearCurriculumCatalog(records), sourceLabel: 'Current library checked. Drafts stay in this browser.' };
};
export const loadLinearCurriculumDraft = async (): Promise<LinearCurriculumDraft | null> => {
  const raw = window.localStorage.getItem(storageKey());
  return raw ? parseLinearCurriculumDraft(JSON.parse(raw)) : null;
};
export const saveLinearCurriculumDraft = async (input: {
  orderedIds: string[];
  rationales: Record<string, string>;
  expectedRevision: number | null;
  catalogFingerprint: string;
}): Promise<LinearCurriculumDraft> => {
  const key = storageKey();
  const catalog = await loadLinearCurriculumCatalog();
  if (catalog.fingerprint !== input.catalogFingerprint) throw new Error('The live library changed. Reload and review the complete sequence before saving.');
  const issues = validateLinearOrder(input.orderedIds, catalog.active);
  if (issues.length) throw new Error(issues.join(' '));
  if (Object.entries(input.rationales).some(([id, value]) => !input.orderedIds.includes(id) || typeof value !== 'string' || value.length > 4000)) throw new Error('Use a rationale of at most 4,000 characters for each ordered skill.');
  const save = (): LinearCurriculumDraft => {
    if (storageKey() !== key) throw new Error('Your account changed. Reload before saving.');
    const raw = window.localStorage.getItem(key);
    const current = raw ? parseLinearCurriculumDraft(JSON.parse(raw)) : null;
    if ((current?.revision ?? null) !== input.expectedRevision) throw new Error('Another tab saved a newer draft. Reload before making further changes.');
    const next: LinearCurriculumDraft = {
      schemaVersion: 1, status: 'draft', revision: (current?.revision || 0) + 1,
      orderedIds: [...input.orderedIds], rationales: { ...input.rationales },
      catalogFingerprint: catalog.fingerprint, updatedAt: new Date().toISOString(), phaseProposal: LINEAR_PHASE_PROPOSAL,
    };
    window.localStorage.setItem(key, JSON.stringify(next));
    return next;
  };
  if (navigator.locks) return navigator.locks.request(key, save);
  return save();
};
