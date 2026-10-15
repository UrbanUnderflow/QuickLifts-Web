import test from 'node:test';
import assert from 'node:assert/strict';
import { formatQueueTimestamp, parseQueueSequences, readQueueSequences, validateQueueListId } from '../../src/utils/pipelistsQueue';

const sequence = () => ({
  id: 'synthetic-sequence', ownerUid: 'synthetic-owner', listId: 'synthetic-list', itemId: 'synthetic-item',
  status: 'active', toEmail: 'recipient@example.test', fromEmail: 'sender@example.test',
  nextStepIndex: 1, nextSendAt: '2030-01-01T12:00:00Z', updatedAt: '2029-12-28T12:00:00Z',
  attempt: { index: 1, startedAt: '2030-01-01T12:00:00Z' }, lastError: 'Synthetic delivery review',
  steps: [{ id: 'email-1', subject: 'Synthetic subject', body: 'Must not be returned by projection', sentAt: '2029-12-28T12:00:00Z', messageId: 'synthetic-message', tracking: { status: 'delivered', lastEventAt: '2029-12-28T12:01:00Z', deliveredAt: '2029-12-28T12:01:00Z', openCount: 0, clickCount: 0 } }],
});
const payload = () => ({ success: true, sequences: [sequence()] });

test('queue scope validates before requesting a token or reading data', async () => {
  let tokens = 0, requests = 0;
  const identity = { uid: 'synthetic-owner', getIdToken: async () => { tokens++; return 'synthetic-token'; } };
  for (const listId of ['', ' ', 'a/b', 'x'.repeat(201)]) {
    await assert.rejects(readQueueSequences({ identity, listId, fetchStatus: async () => { requests++; throw Error('unexpected read'); } }), /valid list ID/);
  }
  assert.equal(tokens, 0); assert.equal(requests, 0);
  assert.throws(() => validateQueueListId(['synthetic-list']), /valid list ID/);
});

test('owner queue uses only the existing scoped GET and never sends a body', async () => {
  const requests: Array<{ url: string; options?: RequestInit }> = [];
  const rows = await readQueueSequences({
    identity: { uid: 'synthetic-owner', getIdToken: async () => 'synthetic-token' }, listId: ' synthetic-list ',
    fetchStatus: async (url, options) => { requests.push({ url: String(url), options }); return { ok: true, json: async () => payload() } as Response; },
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/pipelists/email-sequence?listId=synthetic-list');
  assert.equal(requests[0].options?.method, 'GET');
  assert.equal(requests[0].options?.body, undefined);
  assert.equal(requests[0].options?.cache, 'no-store');
  assert.equal(requests[0].options?.redirect, 'error');
  assert.deepEqual(requests[0].options?.headers, { Authorization: 'Bearer synthetic-token' });
  assert.equal(rows[0].attempt?.index, 1);
  assert.equal(rows[0].steps[0].messageId, 'synthetic-message');
  assert.equal(rows[0].steps[0].tracking?.status, 'delivered');
  assert.equal('body' in rows[0].steps[0], false);
});

test('the view projection rejects cross-owner, cross-list and malformed responses', () => {
  for (const replacement of [{ ownerUid: 'other-owner' }, { listId: 'other-list' }, { id: '' }, { steps: null }]) {
    assert.throws(() => parseQueueSequences({ success: true, sequences: [{ ...sequence(), ...replacement }] }, 'synthetic-list', 'synthetic-owner'), /No queue result/);
  }
  for (const body of [{ success: false, sequences: [] }, {}, null, { success: true, sequences: null }]) {
    assert.throws(() => parseQueueSequences(body, 'synthetic-list', 'synthetic-owner'), /No queue result/);
  }
  assert.deepEqual(parseQueueSequences({ success: true, sequences: [] }, 'synthetic-list', 'synthetic-owner'), []);
});

test('denied reads produce an error instead of an empty queue or a fallback endpoint', async () => {
  for (const status of [401, 403, 404, 500]) {
    let requests = 0;
    await assert.rejects(readQueueSequences({
      identity: { uid: 'synthetic-owner', getIdToken: async () => 'synthetic-token' }, listId: 'synthetic-list',
      fetchStatus: async () => { requests++; return { ok: false, status, json: async () => ({ success: false }) } as Response; },
    }), /session|owner|could not be read/);
    assert.equal(requests, 1);
  }
});

test('cancelled or unsigned reads do not call the endpoint', async () => {
  let requests = 0;
  const fetchStatus: typeof fetch = async () => { requests++; throw Error('unexpected read'); };
  const controller = new AbortController(); controller.abort();
  await assert.rejects(readQueueSequences({ identity: { uid: 'synthetic-owner', getIdToken: async () => 'synthetic-token' }, listId: 'synthetic-list', signal: controller.signal, fetchStatus }), /cancelled/);
  await assert.rejects(readQueueSequences({ identity: { uid: '', getIdToken: async () => 'synthetic-token' }, listId: 'synthetic-list', fetchStatus }), /session/);
  await assert.rejects(readQueueSequences({ identity: { uid: 'synthetic-owner', getIdToken: async () => '' }, listId: 'synthetic-list', fetchStatus }), /session/);
  assert.equal(requests, 0);
});

test('missing timestamps and unknown evidence are not presented as successful delivery', () => {
  assert.equal(formatQueueTimestamp(''), 'Not recorded');
  assert.equal(formatQueueTimestamp('', 'Not scheduled'), 'Not scheduled');
  assert.equal(formatQueueTimestamp('2030-01-01T12:00:00Z'), '2030-01-01 12:00:00 UTC');
  assert.match(formatQueueTimestamp('invalid'), /Unrecognized timestamp/);
  const raw = sequence();
  const row = parseQueueSequences({ success: true, sequences: [{ ...raw, attempt: { startedAt: '' }, steps: [{ id: 'email-1' }] }] }, 'synthetic-list', 'synthetic-owner')[0];
  assert.equal(row.attempt?.index, null);
  assert.equal(row.steps[0].tracking, null);
  assert.equal(row.steps[0].messageId, '');
});
