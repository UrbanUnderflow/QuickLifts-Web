import test from 'node:test';
import assert from 'node:assert/strict';

import { formatEquityContentForPdf } from '../../src/lib/equityDocumentFormatting';

test('equity PDF formatter preserves double-digit legal section headings', () => {
  const html = formatEquityContentForPdf(`
9. Corporate Transactions
The Administrator may adjust awards in a corporate transaction.

10. General Provisions
10.1 Non-Transferability
Awards may not be transferred except as permitted by the Administrator.

11. Adoption and Approval
/s/ Tremaine Grant
`);

  assert.match(html, /<h2>9\. Corporate Transactions<\/h2>/);
  assert.match(html, /<h2>10\. General Provisions<\/h2>/);
  assert.match(html, /<h3>10\.1 Non-Transferability<\/h3>/);
  assert.match(html, /<h2>11\. Adoption and Approval<\/h2>/);
  assert.doesNotMatch(html, /<ol[^>]*>\s*<li>General Provisions<\/li>/);
  assert.doesNotMatch(html, /<ol[^>]*>\s*<li>Adoption and Approval<\/li>/);
});

test('equity PDF formatter still renders real numbered lists as ordered lists', () => {
  const html = formatEquityContentForPdf(`
1. First requirement applies.
2. Second requirement applies.
`);

  assert.match(html, /<ol start="1">/);
  assert.match(html, /<li>First requirement applies\.<\/li>/);
  assert.match(html, /<li>Second requirement applies\.<\/li>/);
});
