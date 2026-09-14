import seed from './linearCurriculumSeed.json';

export type LinearSkillType = 'protocol' | 'simulation';
export interface LinearCurriculumEntry {
  id: string;
  name: string;
  type: LinearSkillType;
  readiness: string;
  rationale: string;
  sourceRefs: string[];
  aliases: string[];
  catalogType: string;
  classificationReason: string;
}
export interface LinearCatalogSource { id: string; [key: string]: unknown }
export type LinearCatalogRecords = Record<string, LinearCatalogSource[]>;
export const FIRST_LINEAR_SKILL = 'protocol-478-breathing';
export const LINEAR_DRAFT_SCHEMA_VERSION = 1;
export const LINEAR_PHASE_PROPOSAL = {
  protocol: { phases: ['Learn', 'Practice', 'Use it'], proposedDays: [5, 5, 5], journalWithin: 'Use it' },
  simulation: { phases: ['Practice', 'Use it'], proposedDays: null, journalWithin: 'Use it' },
  pacingBasis: 'five_days_in_fourteen',
  requiredDistinctDays: 5,
  windowDays: 14,
  restartScope: 'current_phase',
  historyPolicy: 'preserve',
  athleteCutover: 'not_enabled',
} as const;
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const seedActive = seed.active as LinearCurriculumEntry[];
const seedCandidates = seed.candidates as LinearCurriculumEntry[];
const known = new Map([...seedActive, ...seedCandidates].map(entry => [entry.id, entry]));
export const getLinearCurriculumSnapshot = () => ({
  active: seedActive,
  candidates: seedCandidates,
  proposedOrder: seedActive.map(entry => entry.id),
  fingerprint: JSON.stringify(seed),
  sourceLabel: 'Local review using the September 13 catalog snapshot. Drafts stay in this browser.',
});

/** Explicit aliases only. A shared game engine never collapses named variants. */
export const buildLinearCurriculumCatalog = (records: LinearCatalogRecords) => {
  const active = new Map<string, LinearCurriculumEntry>();
  const aliasToCanonical = new Map<string, string>();
  const makeEntry = (record: LinearCatalogSource, type: LinearSkillType, collection: string): LinearCurriculumEntry => {
    const prior = known.get(record.id);
    return {
      id: record.id,
      name: text(record.label) || text(record.name) || text(record.variantName) || prior?.name || record.id,
      type: prior?.type || type,
      readiness: prior?.readiness || 'New catalog entry: review gameplay, classification and position',
      rationale: prior?.rationale || 'New active skill. Review its place before adopting this curriculum.',
      sourceRefs: [...(prior?.sourceRefs || []), `${collection}/${record.id}`].filter((v, i, all) => all.indexOf(v) === i),
      aliases: [...new Set([record.id, ...(prior?.aliases || []), text(record.legacyExerciseId)].filter(Boolean))],
      catalogType: type,
      classificationReason: prior?.classificationReason || 'Classification follows the source until reviewed.',
    };
  };
  for (const record of records['pulsecheck-protocols'] || []) {
    if (record.isActive !== true) continue;
    const entry = makeEntry(record, 'protocol', 'pulsecheck-protocols');
    if (record.publishStatus !== 'published') entry.readiness = 'Active protocol is unpublished: review only';
    active.set(entry.id, entry);
    if (text(record.legacyExerciseId)) aliasToCanonical.set(text(record.legacyExerciseId), entry.id);
  }
  for (const collection of ['sim-modules', 'mental-exercises']) {
    for (const record of records[collection] || []) {
      if (record.isActive !== true) continue;
      const id = aliasToCanonical.get(record.id) || record.id;
      const existing = active.get(id);
      if (existing) {
        existing.sourceRefs = [...new Set([...existing.sourceRefs, `${collection}/${record.id}`])];
        existing.aliases = [...new Set([...existing.aliases, record.id])];
      } else active.set(id, makeEntry(record, 'simulation', collection));
    }
  }
  const proposedOrder = [
    ...seedActive.map(entry => entry.id).filter(id => active.has(id)),
    ...[...active.keys()].filter(id => !seedActive.some(entry => entry.id === id)).sort(),
  ];
  // Registry records describe a runtime when an explicit publication/legacy link resolves.
  for (const collection of ['sim-variants', 'pulsecheck-protocol-variants']) {
    for (const record of records[collection] || []) {
      const linkedId = text(record.publishedModuleId) || text(record.legacyExerciseId);
      const canonical = aliasToCanonical.get(linkedId) || linkedId;
      const entry = active.get(canonical);
      if (entry) entry.sourceRefs = [...new Set([...entry.sourceRefs, `${collection}/${record.id}`])];
    }
  }
  const candidates = new Map<string, LinearCurriculumEntry>();
  for (const collection of ['sim-variants', 'pulsecheck-protocol-variants', 'pulsecheck-protocols', 'sim-modules', 'mental-exercises']) {
    for (const record of records[collection] || []) {
      const canonical = aliasToCanonical.get(record.id) || record.id;
      if (active.has(canonical)) continue;
      const entry = makeEntry(record, collection.startsWith('pulsecheck-protocol') ? 'protocol' : 'simulation', collection);
      entry.readiness = 'Unpublished or inactive: outside active sequence';
      candidates.set(record.id, entry);
    }
  }
  // A registry variant backed by a differently named published module is metadata, not another skill.
  for (const entry of active.values()) {
    for (const ref of entry.sourceRefs) {
      const [collection, id] = ref.split('/');
      if (collection === 'sim-variants' || collection === 'pulsecheck-protocol-variants') candidates.delete(id);
    }
  }
  const entries = proposedOrder.map(id => active.get(id)!);
  const fingerprint = JSON.stringify(entries.map(entry => [entry.id, entry.type, entry.name, entry.sourceRefs.slice().sort()]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
  return { active: entries, candidates: [...candidates.values()].sort((a, b) => a.name.localeCompare(b.name)), proposedOrder, fingerprint };
};

export const validateLinearOrder = (ids: unknown, active: LinearCurriculumEntry[]): string[] => {
  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) return ['The order must be a list of skill IDs.'];
  const expected = new Set(active.map(entry => entry.id));
  const unique = new Set(ids);
  const issues: string[] = [];
  if (ids[0] !== FIRST_LINEAR_SKILL) issues.push('4-7-8 Relaxation Breathing must be first.');
  if (unique.size !== ids.length) issues.push('A skill appears more than once.');
  const missing = [...expected].filter(id => !unique.has(id));
  const unknown = ids.filter(id => !expected.has(id));
  if (missing.length) issues.push(`${missing.length} active skills are missing.`);
  if (unknown.length) issues.push(`${unknown.length} entries are inactive, unpublished or unknown.`);
  if (ids.length !== active.length) issues.push(`The sequence must contain exactly ${active.length} active skills.`);
  return issues;
};

export interface LinearCurriculumDraft {
  schemaVersion: 1;
  status: 'draft';
  revision: number;
  orderedIds: string[];
  rationales: Record<string, string>;
  catalogFingerprint: string;
  updatedAt: string;
  phaseProposal: typeof LINEAR_PHASE_PROPOSAL;
}
export const parseLinearCurriculumDraft = (value: unknown): LinearCurriculumDraft => {
  if (!value || typeof value !== 'object') throw new Error('Invalid curriculum draft.');
  const draft = value as Partial<LinearCurriculumDraft>;
  if (draft.schemaVersion !== 1 || draft.status !== 'draft' || !Array.isArray(draft.orderedIds) || draft.orderedIds.some(id => typeof id !== 'string') || !Number.isInteger(draft.revision) || (draft.revision || 0) < 1 || typeof draft.catalogFingerprint !== 'string' || !draft.rationales || typeof draft.rationales !== 'object' || Array.isArray(draft.rationales) || Object.values(draft.rationales).some(v => typeof v !== 'string' || v.length > 4000)) throw new Error('Draft format is invalid. Export a version 1 curriculum draft.');
  return { ...draft, phaseProposal: LINEAR_PHASE_PROPOSAL } as LinearCurriculumDraft;
};
