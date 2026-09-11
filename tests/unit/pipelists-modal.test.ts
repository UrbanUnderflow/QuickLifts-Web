import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../../src/pages/PipeLists.tsx', import.meta.url), 'utf8');

test('an open lead survives its temporary absence from a synchronized list', () => {
  const start = source.indexOf('  const liveDetailItem =');
  const end = source.indexOf('\n\n', source.indexOf('  const selectedDetailItem =', start));
  const resolve = new Function('activeList', 'selectedDetailItemId', 'detailSnapshotRef', ts.transpile(source.slice(start, end) + '\nreturn selectedDetailItem;'));
  const item = { id: 'penn', title: 'Penn State' };
  const cache = { current: null };
  assert.deepEqual(resolve({ id: 'universities', items: [item] }, 'penn', cache), item);
  assert.deepEqual(resolve({ id: 'universities', items: [] }, 'penn', cache), item);
  const updated = { ...item, title: 'Updated Penn State' };
  assert.deepEqual(resolve({ id: 'universities', items: [updated] }, 'penn', cache), updated);
  assert.equal(resolve({ items: [] }, '', { current: null }), null);
});

test('only the X handler dismisses lead details', () => {
  assert.equal(source.match(/setSelectedDetailItemId\(''\)/g)?.length, 1);
  assert.equal(source.match(/closeLeadDetails\(\)/g)?.length, 1);
  assert.doesNotMatch(source, /const closeOnEscape/);
  const backdrop = source.slice(source.indexOf('{selectedDetailItem && selectedDetailStage && ('), source.indexOf('aria-labelledby="pipe-detail-title"'));
  assert.doesNotMatch(backdrop, /onClick=/);
  assert.match(source, /closeLeadDetails\(\);[\s\S]{0,350}title="Close details"/);
});
