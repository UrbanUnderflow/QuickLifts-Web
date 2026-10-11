import test from 'node:test';
import assert from 'node:assert/strict';
import { parseContactImport, selectNewContacts } from '../../src/utils/pipelistsContactImport';

test('imports only contact fields and preserves research without creating outreach history', () => {
  const [row] = parseContactImport({ contacts: [{ title: ' Speaker ', description: 'Bio', notes: 'Suggested ask; verify affiliation.', stage: 'contacted', lastEmailSentAt: '2026-10-11', contactEmails: ['Speaker@example.com'] }] });
  assert.equal(row.title, 'Speaker');
  assert.equal(row.notes, 'Suggested ask; verify affiliation.');
  assert.deepEqual(row.contactEmails, ['speaker@example.com']);
  assert.equal('stage' in row, false);
  assert.equal('lastEmailSentAt' in row, false);
});

test('rejects invalid links, malformed photos, oversized batches, and missing names before upload', () => {
  for (const row of [{ title: '' }, { title: 'A', sourceUrl: 'javascript:alert(1)' }, { title: 'A', photo: { contentType: 'image/svg+xml', dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' } }, { title: 'A', photo: { contentType: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,@@@' } }]) {
    assert.throws(() => parseContactImport({ contacts: [row] }));
  }
  assert.throws(() => parseContactImport({ contacts: Array(101).fill({ title: 'A' }) }));
});

test('skips existing and repeated contacts by name+organization or email, allowing namesakes', () => {
  const existing = parseContactImport({ contacts: [{ title: 'Alex', organization: 'A', contactEmails: ['alex@example.com'] }] });
  const rows = parseContactImport({ contacts: [
    { title: 'ALEX', organization: 'a' },
    { title: 'Alex Other', contactEmails: ['ALEX@example.com'] },
    { title: 'Alex', organization: 'B' },
    { title: 'New Person', organization: 'C' },
    { title: 'New Person', organization: 'C' },
  ] });
  assert.deepEqual(selectNewContacts(rows, existing).map((row) => row.organization), ['B', 'C']);
  assert.equal(existing.length, 1);
});
