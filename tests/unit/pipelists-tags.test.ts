import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLeadTags } from '../../src/utils/pipelistsTags';

test('legacy leads and malformed stored values have no tags', () => {
  for (const value of [undefined, null, '', {}, 10]) {
    assert.deepEqual(normalizeLeadTags(value), []);
  }
});

test('tags preserve spelling and order, remove blanks and deduplicate case insensitively', () => {
  assert.deepEqual(normalizeLeadTags([
    ' Not at conference ', 'not at conference', '', '  ', null,
    'Pilot   partner', 'PILOT partner', 5, 'Investor',
  ]), ['Not at conference', 'Pilot partner', 'Investor']);
});

test('clearing tags remains empty through a save and reload normalization', () => {
  assert.deepEqual(normalizeLeadTags(normalizeLeadTags(['', ' '])), []);
});
