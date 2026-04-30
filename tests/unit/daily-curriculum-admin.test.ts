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

test('admin daily curriculum generator writes protocol, sim, and generation trace docs', async () => {
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
    },
    'sim-modules': {
      'sim-composure': {
        id: 'sim-composure',
        name: 'Composure Sim',
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
  assert.equal(collections.get('pulsecheck-curriculum-config')?.size, 1);
  assert.equal(collections.get('pulsecheck-daily-assignments')?.size, 2);
  assert.equal(collections.get('pulsecheck-curriculum-generation-traces')?.size, 1);

  const assignments = [...collections.get('pulsecheck-daily-assignments')!.values()];
  assert.equal(assignments.filter((a) => a.assignedBy === 'curriculum-engine').length, 2);
  assert.ok(assignments.find((a) => a.actionType === 'protocol'));
  assert.ok(assignments.find((a) => a.actionType === 'simulation'));
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
