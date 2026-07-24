import test from 'node:test';
import assert from 'node:assert/strict';
import { TaxonomyPillar } from '../../src/api/firebase/mentaltraining/taxonomy';
import {
  generateDailyAssignmentAdmin,
  runCurriculumAssessmentAdmin,
} from '../../netlify/functions/utils/dailyCurriculumAdmin';

type Seed = Record<string, Record<string, Record<string, unknown>>>;

const createFakeFirestore = (seed: Seed = {}) => {
  const collections = new Map<string, Map<string, Record<string, unknown>>>();

  for (const [collectionName, docs] of Object.entries(seed)) {
    const map = new Map<string, Record<string, unknown>>();
    for (const [id, data] of Object.entries(docs)) {
      map.set(id, { ...data });
    }
    collections.set(collectionName, map);
  }

  const collectionFor = (name: string) => {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  };

  const buildDocSnap = (id: string, data: Record<string, unknown> | undefined) => ({
    id,
    exists: Boolean(data),
    data: () => data,
  });

  const collection = (name: string) => {
    const filters: Array<{ field: string; op: string; value: unknown }> = [];
    let order: { field: string; direction: string } | undefined;
    let limitValue: number | undefined;

    const query = {
      doc(id: string) {
        return {
          async get() {
            return buildDocSnap(id, collectionFor(name).get(id));
          },
          async set(data: Record<string, unknown>, options?: { merge?: boolean }) {
            const current = collectionFor(name).get(id) || {};
            collectionFor(name).set(id, options?.merge ? { ...current, ...data } : { ...data });
          },
        };
      },
      where(field: string, op: string, value: unknown) {
        filters.push({ field, op, value });
        return query;
      },
      orderBy(field: string, direction: string) {
        order = { field, direction };
        return query;
      },
      limit(value: number) {
        limitValue = value;
        return query;
      },
      async get() {
        let rows = [...collectionFor(name).entries()].map(([id, data]) => buildDocSnap(id, data));
        for (const filter of filters) {
          rows = rows.filter((doc) => {
            const value = doc.data()?.[filter.field];
            if (filter.op === '==') return value === filter.value;
            if (filter.op === '>=') return Number(value) >= Number(filter.value) || String(value) >= String(filter.value);
            if (filter.op === '<=') return Number(value) <= Number(filter.value) || String(value) <= String(filter.value);
            throw new Error(`Unsupported filter op ${filter.op}`);
          });
        }
        if (order) {
          rows.sort((a, b) => {
            const av = a.data()?.[order!.field] as string | number | undefined;
            const bv = b.data()?.[order!.field] as string | number | undefined;
            const cmp = av === bv ? 0 : av! > bv! ? 1 : -1;
            return order!.direction === 'desc' ? -cmp : cmp;
          });
        }
        return { docs: typeof limitValue === 'number' ? rows.slice(0, limitValue) : rows };
      },
    };

    return query;
  };

  return {
    db: { collection },
    collections,
  };
};

test('admin daily curriculum generator writes six assignment docs, slate, and generation trace docs', async () => {
  const { db, collections } = createFakeFirestore({
    'pulsecheck-protocols': {
      'protocol-composure': {
        id: 'protocol-composure',
        label: 'Composure Reset',
        publishStatus: 'published',
        isActive: true,
        cognitivePillar: TaxonomyPillar.Composure,
        progressionLevel: 'foundational',
        durationSeconds: 120,
      },
      'protocol-box-breathing': {
        id: 'protocol-box-breathing',
        label: 'Box Breathing',
        publishStatus: 'published',
        isActive: true,
        cognitivePillar: TaxonomyPillar.Composure,
        progressionLevel: 'foundational',
        durationSeconds: 120,
      },
      'protocol-visualization': {
        id: 'protocol-visualization',
        label: 'Visualization',
        publishStatus: 'published',
        isActive: true,
        cognitivePillar: TaxonomyPillar.Composure,
        progressionLevel: 'foundational',
        durationSeconds: 120,
      },
    },
    'sim-modules': {
      'sim-composure': {
        id: 'sim-composure',
        name: 'Composure Sim',
        isActive: true,
        taxonomy: { primaryPillar: TaxonomyPillar.Composure },
        progressionLevel: 'foundational',
      },
      'sim-pressure': {
        id: 'sim-pressure',
        name: 'Pressure Sim',
        isActive: true,
        taxonomy: { primaryPillar: TaxonomyPillar.Composure },
        progressionLevel: 'foundational',
      },
      'sim-reset-switch': {
        id: 'sim-reset-switch',
        name: 'The Reset Switch',
        isActive: true,
        taxonomy: { primaryPillar: TaxonomyPillar.Composure },
        progressionLevel: 'foundational',
      },
    },
  });

  const result = await generateDailyAssignmentAdmin(db as any, {
    athleteUserId: 'athlete-1',
    teamId: 'team-1',
    teamMembershipId: 'membership-1',
    sourceDate: '2026-04-30',
    timezone: 'America/New_York',
  });

  assert.ok(result);
  assert.equal(result.protocolSelection.protocolId, 'protocol-composure');
  assert.equal(result.simSelection.simId, 'sim-composure');
  assert.equal(result.protocolSelections?.length, 3);
  assert.equal(result.simSelections?.length, 3);
  assert.equal(result.dailyAssignmentIdsProtocol?.length, 3);
  assert.equal(result.dailyAssignmentIdsSim?.length, 3);
  assert.equal(result.queuedAssignmentIds?.length, 6);
  assert.equal(result.dueAssignmentIds?.length, 2);
  assert.equal(collections.get('pulsecheck-curriculum-config')?.size, 1);
  assert.equal(collections.get('pulsecheck-daily-assignments')?.size, 6);
  assert.equal(collections.get('pulsecheck-curriculum-slates')?.size, 1);
  assert.equal(collections.get('pulsecheck-curriculum-generation-traces')?.size, 1);

  const assignments = [...collections.get('pulsecheck-daily-assignments')!.values()];
  assert.equal(assignments.filter((a) => a.assignedBy === 'curriculum-engine').length, 6);
  assert.equal(assignments.filter((a) => a.actionType === 'protocol').length, 3);
  assert.equal(assignments.filter((a) => a.actionType === 'simulation').length, 3);
  const protocolAssignment = assignments.find((a) => a.actionType === 'protocol');
  const simAssignment = assignments.find((a) => a.actionType === 'simulation');
  assert.ok(protocolAssignment);
  assert.ok(simAssignment);
  assert.equal(protocolAssignment!.curriculumSlotKind, 'protocol');
  assert.equal(protocolAssignment!.curriculumSlotIndex, 1);
  assert.equal(protocolAssignment!.curriculumIsDueToday, true);
  assert.equal(simAssignment!.curriculumSlotKind, 'simulation');
  assert.equal((protocolAssignment!.curriculumIntent as any)?.source, 'curriculum-engine');
  assert.equal((protocolAssignment!.curriculumIntent as any)?.pairedAssignmentLabel, 'Composure Sim');
  assert.match(String((simAssignment!.curriculumIntent as any)?.whyThisToday), /Composure Sim/);
  assert.match(String((simAssignment!.curriculumIntent as any)?.progressionCriteria), /planned practices/);
});

test('admin daily curriculum generator can assign legacy category-only production assets', async () => {
  const { db, collections } = createFakeFirestore({
    'pulsecheck-protocols': {
      'protocol-box-breathing': {
        label: 'Box Breathing',
        publishStatus: 'published',
        isActive: true,
        category: 'breathing',
        durationSeconds: 120,
      },
    },
    'sim-modules': {
      'sim-focus': {
        name: 'Focus Sim',
        isActive: true,
        category: 'focus',
      },
    },
  });

  const result = await generateDailyAssignmentAdmin(db as any, {
    athleteUserId: 'athlete-legacy',
    teamId: 'team-1',
    teamMembershipId: 'membership-1',
    sourceDate: '2026-05-01',
    timezone: 'America/New_York',
  });

  assert.ok(result);
  assert.equal(result.protocolSelection.protocolId, 'protocol-box-breathing');
  assert.equal(result.protocolSelection.cognitivePillar, TaxonomyPillar.Composure);
  assert.equal(result.simSelection.simId, 'sim-focus');
  assert.equal(result.simSelection.cognitivePillar, TaxonomyPillar.Focus);
  assert.equal(collections.get('pulsecheck-daily-assignments')?.size, 2);
  assert.equal(result.queuedAssignmentIds?.length, 2);
  const simAssignment = [...collections.get('pulsecheck-daily-assignments')!.values()]
    .find((assignment) => assignment.actionType === 'simulation');
  assert.equal(simAssignment?.simName, 'Focus Sim');
  assert.equal(simAssignment?.simSpecId, 'sim-focus');
});

test('admin daily curriculum generator rejects stale cross-type fields and covers each available pillar', async () => {
  const protocols = Object.fromEntries(
    Object.values(TaxonomyPillar).map((pillar) => [
      `protocol-${pillar}`,
      {
        id: `protocol-${pillar}`,
        label: `${pillar} protocol`,
        publishStatus: 'published',
        isActive: true,
        cognitivePillar: pillar,
        progressionLevel: 'foundational',
        durationSeconds: 120,
      },
    ]),
  );
  const sims = Object.fromEntries(
    Object.values(TaxonomyPillar).map((pillar) => [
      `sim-${pillar}`,
      {
        id: `sim-${pillar}`,
        name: `${pillar} simulation`,
        isActive: true,
        taxonomy: { primaryPillar: pillar },
        progressionLevel: 'foundational',
      },
    ]),
  );
  const { db, collections } = createFakeFirestore({
    'pulsecheck-protocols': protocols,
    'sim-modules': sims,
    'pulsecheck-daily-assignments': {
      'stale-sim': {
        id: 'stale-sim',
        athleteId: 'athlete-stale',
        teamId: 'team-1',
        teamMembershipId: 'membership-1',
        sourceDate: '2026-07-24',
        assignedBy: 'curriculum-engine',
        actionType: 'simulation',
        protocolId: 'protocol-composure',
        protocolLabel: '4-7-8 Relaxation Breathing',
        simSpecId: 'sim-focus',
        simName: 'Focus simulation',
      },
    },
  });

  const result = await generateDailyAssignmentAdmin(db as any, {
    athleteUserId: 'athlete-stale',
    teamId: 'team-1',
    teamMembershipId: 'membership-1',
    sourceDate: '2026-07-24',
    timezone: 'America/New_York',
  });

  assert.ok(result);
  assert.deepEqual(
    new Set(result.protocolSelections?.map((selection) => selection.cognitivePillar)),
    new Set(Object.values(TaxonomyPillar)),
  );
  assert.deepEqual(
    new Set(result.simSelections?.map((selection) => selection.cognitivePillar)),
    new Set(Object.values(TaxonomyPillar)),
  );

  const generated = [...collections.get('pulsecheck-daily-assignments')!.values()]
    .filter((assignment) => assignment.id !== 'stale-sim');
  assert.equal(generated.filter((assignment) => assignment.actionType === 'protocol').length, 3);
  assert.equal(generated.filter((assignment) => assignment.actionType === 'simulation').length, 3);
  assert.ok(generated
    .filter((assignment) => assignment.actionType === 'simulation')
    .every((assignment) => !assignment.protocolId && !assignment.protocolLabel));
});

test('admin daily curriculum generator repairs duplicate existing skills with missing discipline coverage', async () => {
  const protocols = Object.fromEntries(
    Object.values(TaxonomyPillar).map((pillar) => [
      `protocol-${pillar}`,
      {
        id: `protocol-${pillar}`,
        label: `${pillar} protocol`,
        publishStatus: 'published',
        isActive: true,
        cognitivePillar: pillar,
        progressionLevel: 'foundational',
        durationSeconds: 120,
      },
    ]),
  );
  const sims = Object.fromEntries(
    Object.values(TaxonomyPillar).map((pillar) => [
      `sim-${pillar}`,
      {
        id: `sim-${pillar}`,
        name: `${pillar} simulation`,
        isActive: true,
        taxonomy: { primaryPillar: pillar },
        progressionLevel: 'foundational',
      },
    ]),
  );
  const duplicateProtocol = {
    athleteId: 'athlete-duplicate',
    teamId: 'team-1',
    teamMembershipId: 'membership-1',
    sourceDate: '2026-07-24',
    assignedBy: 'curriculum-engine',
    actionType: 'protocol',
    protocolId: 'protocol-composure',
    protocolLabel: 'composure protocol',
    cognitivePillar: TaxonomyPillar.Composure,
  };
  const { db } = createFakeFirestore({
    'pulsecheck-protocols': protocols,
    'sim-modules': sims,
    'pulsecheck-daily-assignments': {
      'duplicate-protocol-1': {
        ...duplicateProtocol,
        id: 'duplicate-protocol-1',
        curriculumSlotIndex: 1,
      },
      'duplicate-protocol-2': {
        ...duplicateProtocol,
        id: 'duplicate-protocol-2',
        curriculumSlotIndex: 2,
      },
    },
  });

  const result = await generateDailyAssignmentAdmin(db as any, {
    athleteUserId: 'athlete-duplicate',
    teamId: 'team-1',
    teamMembershipId: 'membership-1',
    sourceDate: '2026-07-24',
    timezone: 'America/New_York',
  });

  assert.ok(result);
  assert.equal(result.dailyAssignmentIdsProtocol?.length, 3);
  assert.equal(result.dailyAssignmentIdsSim?.length, 3);
  assert.deepEqual(
    new Set(result.protocolSelections?.map((selection) => selection.cognitivePillar)),
    new Set(Object.values(TaxonomyPillar)),
  );
  assert.deepEqual(
    new Set(result.simSelections?.map((selection) => selection.cognitivePillar)),
    new Set(Object.values(TaxonomyPillar)),
  );
});

test('admin curriculum assessment writes monthly rollup doc', async () => {
  const eventAt = Date.UTC(2026, 3, 15, 12, 0, 0) / 1000;
  const { db, collections } = createFakeFirestore({
    'pulsecheck-protocols': {
      'protocol-focus': {
        id: 'protocol-focus',
        label: 'Focus Reset',
        isActive: true,
        cognitivePillar: TaxonomyPillar.Focus,
        progressionLevel: 'foundational',
      },
    },
    'sim-modules': {
      'sim-decision': {
        id: 'sim-decision',
        name: 'Decision Sim',
        isActive: true,
        taxonomy: { primaryPillar: TaxonomyPillar.Decision },
        progressionLevel: 'foundational',
      },
    },
    'pulsecheck-daily-assignments': {
      assignment1: {
        id: 'assignment1',
        athleteId: 'athlete-1',
        sourceDate: '2026-04-15',
        chosenCandidateId: 'protocol-focus',
      },
      assignment2: {
        id: 'assignment2',
        athleteId: 'athlete-1',
        sourceDate: '2026-04-15',
        chosenCandidateId: 'sim-decision',
      },
    },
    'pulsecheck-assignment-events': {
      event1: {
        id: 'event1',
        athleteId: 'athlete-1',
        eventType: 'completed',
        eventAt,
        chosenCandidateId: 'protocol-focus',
      },
      event2: {
        id: 'event2',
        athleteId: 'athlete-1',
        eventType: 'completed',
        eventAt,
        chosenCandidateId: 'sim-decision',
      },
    },
  });

  const assessment = await runCurriculumAssessmentAdmin(db as any, {
    athleteUserId: 'athlete-1',
    yearMonth: '2026-04',
  });

  assert.ok(assessment);
  assert.equal(assessment.totalAssignmentsAssigned, 2);
  assert.equal(assessment.totalAssignmentsCompleted, 2);
  assert.equal(assessment.longestStreakDays, 1);
  assert.equal(assessment.protocolRepCounts[0].protocolId, 'protocol-focus');
  assert.equal(assessment.simRepCounts[0].simId, 'sim-decision');
  assert.ok(collections.get('pulsecheck-curriculum-assessments')?.has('athlete-1_2026-04'));
});
