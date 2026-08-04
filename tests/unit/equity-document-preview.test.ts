import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildScopedEquityDocumentUrl,
  signingRequestCanAccessEquityDocument,
} from '../../src/lib/equityDocumentPreview';

test('supporting equity document URLs are scoped to one signing request', () => {
  assert.equal(
    buildScopedEquityDocumentUrl('https://fitwithpulse.ai/', 'board consent', 'request/123'),
    'https://fitwithpulse.ai/equity-doc/board%20consent?requestId=request%2F123',
  );
});

test('only active signing requests can open their own supporting documents', () => {
  const signingRequest = {
    supportingDocuments: [
      { id: 'eip-1', url: 'https://fitwithpulse.ai/equity-doc/eip-1' },
      { id: 'board-1', url: 'https://fitwithpulse.ai/equity-doc/board-1' },
    ],
  };

  assert.equal(signingRequestCanAccessEquityDocument(signingRequest, 'eip-1'), true);
  assert.equal(signingRequestCanAccessEquityDocument(signingRequest, 'other-doc'), false);
  assert.equal(
    signingRequestCanAccessEquityDocument({ ...signingRequest, invalidatedAt: 'now' }, 'eip-1'),
    false,
  );
});

