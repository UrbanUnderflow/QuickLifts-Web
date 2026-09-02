import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPipeListsRunbookLineDiff,
  DEFAULT_PIPELISTS_RUNBOOK_CONTENT,
  isSafePipeListsRunbookUrl,
  summarizePipeListsRunbookDiff,
} from '../../src/utils/pipelistsRunbook';

test('runbook diff records exact added and removed lines', () => {
  const diff = buildPipeListsRunbookLineDiff(
    ['First line', 'Original detail', 'Final line'].join('\n'),
    ['First line', 'Updated detail', 'Final line', 'New resource'].join('\n'),
  );

  assert.deepEqual(
    diff.filter((line) => line.kind !== 'unchanged'),
    [
      { kind: 'removed', text: 'Original detail', beforeLineNumber: 2 },
      { kind: 'added', text: 'Updated detail', afterLineNumber: 2 },
      { kind: 'added', text: 'New resource', afterLineNumber: 4 },
    ],
  );
  assert.deepEqual(summarizePipeListsRunbookDiff(diff), {
    additions: 2,
    removals: 1,
    changedLines: 3,
  });
});

test('runbook diff normalizes Windows line endings', () => {
  const diff = buildPipeListsRunbookLineDiff('Line one\r\nLine two', 'Line one\nLine two');
  assert.deepEqual(summarizePipeListsRunbookDiff(diff), {
    additions: 0,
    removals: 0,
    changedLines: 0,
  });
});

test('runbook diff isolates a local edit inside a long wiki page', () => {
  const beforeLines = Array.from({ length: 1_200 }, (_, index) => `Runbook line ${index + 1}`);
  const afterLines = [...beforeLines];
  afterLines[600] = 'Updated pilot handoff requirement';

  const changed = buildPipeListsRunbookLineDiff(beforeLines.join('\n'), afterLines.join('\n')).filter(
    (line) => line.kind !== 'unchanged',
  );

  assert.deepEqual(changed, [
    { kind: 'removed', text: 'Runbook line 601', beforeLineNumber: 601 },
    { kind: 'added', text: 'Updated pilot handoff requirement', afterLineNumber: 601 },
  ]);
});

test('runbook links allow useful resource schemes and block executable schemes', () => {
  assert.equal(isSafePipeListsRunbookUrl('https://fitwithpulse.ai/resources'), true);
  assert.equal(isSafePipeListsRunbookUrl('mailto:hello@fitwithpulse.ai'), true);
  assert.equal(isSafePipeListsRunbookUrl('/sales/pilot-overview.pdf'), true);
  assert.equal(isSafePipeListsRunbookUrl('#pilot-handoff'), true);
  assert.equal(isSafePipeListsRunbookUrl('javascript:alert(1)'), false);
  assert.equal(isSafePipeListsRunbookUrl('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(isSafePipeListsRunbookUrl('//untrusted.example/resource'), false);
});

test('starter runbook covers the message sequence, resource package, and customer success handoff', () => {
  assert.match(DEFAULT_PIPELISTS_RUNBOOK_CONTENT, /Initial outreach sequence/);
  assert.match(DEFAULT_PIPELISTS_RUNBOOK_CONTENT, /Required resource package/);
  assert.match(DEFAULT_PIPELISTS_RUNBOOK_CONTENT, /Pilot handoff and customer success/);
  assert.match(DEFAULT_PIPELISTS_RUNBOOK_CONTENT, /Security, privacy, data-flow, and accessibility packet/);
});
