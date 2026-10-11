import assert from 'node:assert/strict';
import test from 'node:test';
import { getLinkedLeads, normalizeLinkedLeadIds, setLeadLink } from '../../src/utils/pipelistsLinkedLeads';

test('legacy and malformed link values normalize safely', () => {
  assert.deepEqual(normalizeLinkedLeadIds(undefined, 'a'), []);
  assert.deepEqual(normalizeLinkedLeadIds(['a', 'b', 'b', null, ''], 'a'), ['b']);
});
test('link and unlink update both leads, preserve other fields and survive serialization', () => {
  const items = [{ id: 'a', updatedAt: 'old', stage: 'met-in-person' }, { id: 'b', updatedAt: 'old', stage: 'sourced' }, { id: 'c', updatedAt: 'old', stage: 'sourced' }];
  const linked = setLeadLink(items, 'a', 'b', true, 'now');
  assert.deepEqual(getLinkedLeads(JSON.parse(JSON.stringify(linked)), 'b').map(item => item.id), ['a']);
  assert.equal(linked[0].stage, 'met-in-person');
  assert.equal(linked[2], items[2]);
  const unlinked = setLeadLink(linked, 'b', 'a', false, 'later');
  assert.deepEqual(getLinkedLeads(unlinked, 'a'), []);
  assert.deepEqual(getLinkedLeads(unlinked, 'b'), []);
});
test('invalid targets are ignored and deleted or moved targets are hidden', () => {
  const items = [{ id: 'a', updatedAt: '', linkedLeadIds: ['b', 'c'] }, { id: 'b', updatedAt: '', deletedAt: 'now' }, { id: 'c', updatedAt: '', movedToListId: 'elsewhere' }];
  assert.equal(setLeadLink(items, 'a', 'a', true, 'now'), items);
  assert.equal(setLeadLink(items, 'a', 'missing', true, 'now'), items);
  assert.equal(setLeadLink(items, 'a', 'b', true, 'now'), items);
  assert.deepEqual(getLinkedLeads(items, 'a'), []);
});
