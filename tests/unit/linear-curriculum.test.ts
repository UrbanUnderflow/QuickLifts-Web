import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLinearCurriculumCatalog,
  FIRST_LINEAR_SKILL,
  getLinearCurriculumSnapshot,
  LINEAR_PHASE_PROPOSAL,
  parseLinearCurriculumDraft,
  validateLinearOrder,
  type LinearCatalogRecords,
} from '../../src/api/firebase/dailyCurriculum/linearCurriculum';

const snapshot = getLinearCurriculumSnapshot();

test('linear snapshot accounts for the full active catalog and separate candidates', () => {
  assert.equal(snapshot.active.length, 77);
  assert.equal(snapshot.candidates.length, 56);
  const activeIDs = new Set(snapshot.active.map(entry => entry.id));
  assert.equal(activeIDs.size, 77);
  assert.equal(new Set(snapshot.candidates.map(entry => entry.id)).size, 56);
  assert.ok(snapshot.candidates.every(entry => !activeIDs.has(entry.id)));
  assert.equal(snapshot.active.filter(entry => entry.type === 'protocol').length, 17);
  assert.equal(snapshot.active.filter(entry => entry.type === 'simulation').length, 60);
  assert.equal(snapshot.proposedOrder[0], FIRST_LINEAR_SKILL);
  assert.deepEqual(validateLinearOrder(snapshot.proposedOrder, snapshot.active), []);
});

test('all 51 named published variants survive as distinct ordered skills', () => {
  const variants = snapshot.active.filter(entry => entry.sourceRefs.some(ref => ref.startsWith('sim-variants/')));
  assert.equal(variants.length, 51);
  assert.equal(new Set(variants.map(entry => entry.id)).size, 51);
  assert.ok(variants.every(entry => entry.type === 'simulation' && snapshot.proposedOrder.includes(entry.id)));
  assert.ok(variants.every(entry => entry.name.trim() && entry.rationale.trim()));
});

test('five proposed reclassifications retain source taxonomy and explicit explanation', () => {
  const changed = snapshot.active.filter(entry => entry.type !== entry.catalogType);
  assert.deepEqual(changed.map(entry => entry.id).sort(), [
    'confidence-affirmations', 'confidence-inventory', 'focus-single-point',
    'viz-competition-walkthrough', 'viz-highlight-reel',
  ]);
  for (const entry of changed) {
    assert.equal(entry.catalogType, 'simulation');
    assert.equal(entry.type, 'protocol');
    assert.ok(entry.classificationReason.trim());
  }
});

test('protocol aliases merge duplicate storage records without collapsing shared-engine variants', () => {
  const catalog = buildLinearCurriculumCatalog({
    'pulsecheck-protocols': [{ id: FIRST_LINEAR_SKILL, label: '4-7-8', legacyExerciseId: 'breathing-478', isActive: true, publishStatus: 'published' }],
    'sim-modules': [
      { id: 'breathing-478', name: 'Legacy breathing', isActive: true },
      { id: 'variant-one', name: 'Variant one', engineKey: 'reset', isActive: true },
      { id: 'variant-two', name: 'Variant two', engineKey: 'reset', isActive: true },
    ],
    'mental-exercises': [{ id: 'variant-one', name: 'Older variant name', isActive: true }],
    'sim-variants': [{ id: 'draft-only', name: 'Unpublished candidate' }],
  });
  assert.deepEqual(catalog.proposedOrder, [FIRST_LINEAR_SKILL, 'variant-one', 'variant-two']);
  assert.equal(catalog.active[1].name, 'Variant one');
  assert.ok(catalog.active[0].aliases.includes('breathing-478'));
  assert.ok(catalog.active[0].sourceRefs.includes('sim-modules/breathing-478'));
  assert.ok(catalog.active[1].sourceRefs.includes('mental-exercises/variant-one'));
  assert.deepEqual(catalog.candidates.map(entry => entry.id), ['draft-only']);
});

test('active unpublished protocols are review-only and inactive records remain outside sequence', () => {
  const catalog = buildLinearCurriculumCatalog({
    'pulsecheck-protocols': [{ id: FIRST_LINEAR_SKILL, isActive: true, publishStatus: 'draft' }],
    'sim-modules': [{ id: 'retired', isActive: false }, { id: 'missing-active-flag' }],
  });
  assert.equal(catalog.active.length, 1);
  assert.match(catalog.active[0].readiness, /unpublished.*review only/);
  assert.deepEqual(new Set(catalog.candidates.map(entry => entry.id)), new Set(['retired', 'missing-active-flag']));
});

test('explicit registry publication links attach metadata without extra sequence or candidate rows', () => {
  const catalog = buildLinearCurriculumCatalog({
    'pulsecheck-protocols': [{ id: FIRST_LINEAR_SKILL, legacyExerciseId: 'breathing-478', isActive: true, publishStatus: 'published' }],
    'sim-modules': [{ id: 'published-simulation', name: 'Published simulation', isActive: true }],
    'sim-variants': [
      { id: 'different-registry-id', publishedModuleId: 'published-simulation' },
      { id: 'unmapped-sim', publishedModuleId: 'missing-module' },
    ],
    'pulsecheck-protocol-variants': [
      { id: 'linked-protocol-variant', legacyExerciseId: 'breathing-478' },
      { id: 'unmapped-protocol-variant', legacyExerciseId: 'missing-protocol' },
    ],
  });
  assert.deepEqual(catalog.proposedOrder, [FIRST_LINEAR_SKILL, 'published-simulation']);
  assert.ok(catalog.active[0].sourceRefs.includes('pulsecheck-protocol-variants/linked-protocol-variant'));
  assert.ok(catalog.active[1].sourceRefs.includes('sim-variants/different-registry-id'));
  assert.deepEqual(new Set(catalog.candidates.map(entry => entry.id)), new Set(['unmapped-sim', 'unmapped-protocol-variant']));
  assert.equal(catalog.candidates.find(entry => entry.id === 'unmapped-protocol-variant')?.type, 'protocol');
  assert.equal(catalog.candidates.find(entry => entry.id === 'unmapped-sim')?.type, 'simulation');
});

test('reconstructing catalog source records retains all active IDs and candidates', () => {
  const records: LinearCatalogRecords = {};
  const supported = new Set(['pulsecheck-protocols', 'sim-modules', 'mental-exercises', 'sim-variants']);
  for (const entry of [...snapshot.active, ...snapshot.candidates]) {
    for (const ref of entry.sourceRefs) {
      const [collection, id] = ref.split('/');
      if (!supported.has(collection)) continue;
      const record = {
        id, name: entry.name,
        isActive: snapshot.active.includes(entry), publishStatus: 'published',
        ...(collection === 'pulsecheck-protocols' ? { legacyExerciseId: entry.aliases.find(alias => alias !== entry.id) } : {}),
      };
      (records[collection] ||= []).push(record);
    }
  }
  const catalog = buildLinearCurriculumCatalog(records);
  assert.deepEqual(catalog.proposedOrder, snapshot.proposedOrder);
  assert.equal(catalog.candidates.length, 56);
  assert.deepEqual(new Set(catalog.candidates.map(entry => entry.id)), new Set(snapshot.candidates.map(entry => entry.id)));
});

test('order validation rejects missing, duplicated, unknown and displaced first skills', () => {
  const ids = snapshot.proposedOrder;
  assert.match(validateLinearOrder(ids.slice(0, -1), snapshot.active).join(' '), /missing/);
  assert.match(validateLinearOrder([...ids, ids[1]], snapshot.active).join(' '), /more than once/);
  assert.match(validateLinearOrder([...ids.slice(0, -1), 'not-a-skill'], snapshot.active).join(' '), /unknown/);
  assert.match(validateLinearOrder([ids[1], ids[0], ...ids.slice(2)], snapshot.active).join(' '), /must be first/);
  for (const bad of [null, {}, 'ids', [FIRST_LINEAR_SKILL, 123]]) {
    assert.match(validateLinearOrder(bad, snapshot.active).join(' '), /list of skill IDs/);
  }
});

const draft = () => ({
  schemaVersion: 1, status: 'draft', revision: 1,
  orderedIds: [...snapshot.proposedOrder], rationales: { [FIRST_LINEAR_SKILL]: 'Start here.' },
  catalogFingerprint: snapshot.fingerprint, updatedAt: '2026-09-13T12:00:00.000Z',
  phaseProposal: LINEAR_PHASE_PROPOSAL,
});

test('draft parser preserves rationale and enforces proposal-only pacing/cutover contract', () => {
  const parsed = parseLinearCurriculumDraft({ ...draft(), phaseProposal: { athleteCutover: 'enabled', pacingBasis: 'validated' } });
  assert.equal(parsed.rationales[FIRST_LINEAR_SKILL], 'Start here.');
  assert.deepEqual(parsed.phaseProposal, LINEAR_PHASE_PROPOSAL);
  assert.equal(parsed.phaseProposal.athleteCutover, 'not_enabled');
  assert.equal(parsed.phaseProposal.pacingBasis, 'five_days_in_fourteen');
});

test('malformed stored draft structural fields are rejected', () => {
  const malformed = [
    null, false, 5, 'draft', [], {},
    ...[0, -1, 1.5, '1', null].map(revision => ({ ...draft(), revision })),
    { ...draft(), schemaVersion: 2 }, { ...draft(), status: 'published' },
    { ...draft(), orderedIds: null }, { ...draft(), orderedIds: [123] },
    { ...draft(), catalogFingerprint: null }, { ...draft(), rationales: [] },
    { ...draft(), rationales: null }, { ...draft(), rationales: { x: 12 } },
    { ...draft(), rationales: { x: 'x'.repeat(4001) } },
  ];
  for (const value of malformed) assert.throws(() => parseLinearCurriculumDraft(value));
  assert.doesNotThrow(() => parseLinearCurriculumDraft({ ...draft(), rationales: { x: 'x'.repeat(4000) } }));
});

test('well-formed imported orders still require semantic catalog validation', () => {
  const parsed = parseLinearCurriculumDraft({ ...draft(), orderedIds: [FIRST_LINEAR_SKILL, 'stale-catalog-id'] });
  assert.ok(validateLinearOrder(parsed.orderedIds, snapshot.active).length > 0);
});
