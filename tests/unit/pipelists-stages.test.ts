import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcilePipeListStages } from '../../src/utils/pipelistsStages';

test('an older template preserves saved contact lanes across reloads', () => {
  const old = [{ id: 'sourced' }, { id: 'contacted' }];
  const saved = [{ id: 'sourced' }, { id: 'warm-introduction' }, { id: 'met-in-person' }, { id: 'contacted' }];
  const loaded = reconcilePipeListStages(saved, old);
  assert.ok(loaded.some(s => s.id === 'warm-introduction'));
  assert.ok(loaded.some(s => s.id === 'met-in-person'));
  assert.deepEqual(reconcilePipeListStages(JSON.parse(JSON.stringify(loaded)), old), loaded);
});

test('template upgrade adds new lanes and preserves saved custom stage settings', () => {
  const saved = [{ id: 'sourced', label: 'New' }, { id: 'custom', label: 'My lane' }];
  const defaults = [{ id: 'sourced', label: 'Sourced' }, { id: 'warm-introduction', label: 'Warm Introduction' }];
  assert.deepEqual(reconcilePipeListStages(saved, defaults), [saved[0], defaults[1], saved[1]]);
});
