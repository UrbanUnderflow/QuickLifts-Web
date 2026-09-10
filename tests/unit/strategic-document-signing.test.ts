import assert from 'node:assert/strict';
import test from 'node:test';
import { renderStrategicSigningHtml, isStrategicDocument } from '../../src/lib/strategicDocumentSigning';

const prepared = {
  title: 'Strategic partnership warrant',
  content: '## 14.4A Competitor Change of Control\n\nApproved agreement text.',
  recipientName: 'Tracey Hathaway',
  recipientEmail: 'tracey@example.test',
  signerRole: 'AuntEdna authorized signatory',
};

test('an unsigned strategic request does not render a company signature', () => {
  const html = renderStrategicSigningHtml(prepared);
  assert.match(html, /Awaiting signature/);
  assert.doesNotMatch(html, /Tremaine Grant|Electronic signature record/);
  assert.match(html, /14\.4A Competitor Change of Control/);
});

test('a signed copy records only the actual signer and persisted signing date', () => {
  const html = renderStrategicSigningHtml({ ...prepared, signedName: 'Tracey Hathaway', signedAt: '2026-09-09T21:00:00.000Z' });
  assert.match(html, /Electronic signature record/);
  assert.match(html, /2026-09-09T21:00:00.000Z/);
  assert.doesNotMatch(html, /Tremaine Grant|Awaiting signature/);
});

test('signature identity is escaped and existing document types retain their flow', () => {
  const html = renderStrategicSigningHtml({ ...prepared, signedName: '<script>bad()</script>' });
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.equal(isStrategicDocument('strategic_board_consent_pil'), true);
  assert.equal(isStrategicDocument('advisor_nso_agreement'), false);
});
