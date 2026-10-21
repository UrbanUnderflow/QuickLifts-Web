import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesLeadTagFilters, normalizeLeadTags } from '../../src/utils/pipelistsTags';

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

test('tag filters match any selected category using normalized exact names', () => {
  assert.equal(matchesLeadTagFilters(['Federal   Grants', 'Research'], [' federal grants ']), true);
  assert.equal(matchesLeadTagFilters(['Pitch Competition'], ['Federal Grants', 'pitch competition']), true);
  assert.equal(matchesLeadTagFilters(['Grant'], ['Federal Grants']), false);
  assert.equal(matchesLeadTagFilters(['Research'], ['Federal Grants', 'Pitch Competition']), false);
});

test('no selected tags includes legacy leads; an active tag excludes untagged leads', () => {
  assert.equal(matchesLeadTagFilters(undefined, []), true);
  assert.equal(matchesLeadTagFilters(['Federal Grants'], []), true);
  assert.equal(matchesLeadTagFilters(undefined, ['Federal Grants']), false);
  assert.equal(matchesLeadTagFilters([], ['Pitch Competition']), false);
});
