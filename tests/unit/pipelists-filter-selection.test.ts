import test from 'node:test';
import assert from 'node:assert/strict';
import {
  matchesPipelineFilters,
  toggleFilterSelection,
} from '../../src/utils/pipelistsFilters';

test('stage and priority selections toggle independently and return to all when empty', () => {
  let stages = toggleFilterSelection<string>([], 'pilot-agreed');
  stages = toggleFilterSelection(stages, 'pilot-active');
  assert.deepEqual(stages, ['pilot-agreed', 'pilot-active']);

  stages = toggleFilterSelection(stages, 'pilot-agreed');
  assert.deepEqual(stages, ['pilot-active']);
  stages = toggleFilterSelection(stages, 'pilot-active');
  assert.deepEqual(stages, []);

  let priorities = toggleFilterSelection<'high' | 'medium' | 'low'>([], 'high');
  priorities = toggleFilterSelection(priorities, 'medium');
  assert.deepEqual(priorities, ['high', 'medium']);
  priorities = toggleFilterSelection(priorities, 'high');
  assert.deepEqual(priorities, ['medium']);
});

test('filters use OR within a category and AND between stage and priority', () => {
  const rows = [
    { id: 'one', stage: 'pilot-agreed', priority: 'high' },
    { id: 'two', stage: 'pilot-active', priority: 'medium' },
    { id: 'three', stage: 'pilot-active', priority: 'low' },
    { id: 'four', stage: 'identified', priority: 'high' },
  ] as const;

  const matched = rows
    .filter((row) =>
      matchesPipelineFilters(
        row,
        ['pilot-agreed', 'pilot-active'],
        ['high', 'medium'],
      ),
    )
    .map((row) => row.id);

  assert.deepEqual(matched, ['one', 'two']);
  assert.deepEqual(rows.filter((row) => matchesPipelineFilters(row, [], [])).map((row) => row.id), [
    'one',
    'two',
    'three',
    'four',
  ]);
});
