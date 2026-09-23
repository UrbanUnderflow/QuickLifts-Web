import test from 'node:test';
import assert from 'node:assert/strict';
import { __test } from '../../netlify/functions/generate-equity-document';

for (const documentType of ['board_consent', 'stockholder_consent']) {
  test(`${documentType} prepares unsigned consent and rejects fabricated execution`, () => {
    const template = __test.DOCUMENT_TEMPLATES[documentType];
    const body = { documentType, stakeholderName: 'Test Recipient' };
    const prompt = template.systemPrompt + template.userPrompt(body);
    assert.match(prompt, /unsigned draft/i);
    assert.match(prompt, /actual.*(?:execution|signature).*date/i);
    assert.doesNotMatch(prompt, /\/s\/ Tremaine Grant|must appear ALREADY EXECUTED|being the sole member/i);
    assert.ok(__test.collectGeneratedContentIssues(documentType, 'DRAFT\nSignature: ____\n/s/ Tremaine Grant\nDate: September 23, 2026', body).some(issue => /executed signature/.test(issue)));
    assert.ok(!__test.collectGeneratedContentIssues(documentType, 'DRAFT awaiting approval\nSignature: ____\nActual signature date: ____', body).some(issue => /executed signature|blank signature|identified as awaiting/.test(issue)));
  });
}
