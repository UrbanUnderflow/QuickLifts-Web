import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BODY_SCAN_INSTRUCTIONS,
  BODY_SCAN_SCRIPT,
  bodyScanInstructionsAreDirect,
} from '../../src/content/bodyScanScript';

const unclearBodyScanPatterns = [
  /\bquiet(?:er)?\b/i,
  /\bsoften\b/i,
  /\bget heavy\b/i,
  /\bbeing held\b/i,
  /\bholding effort\b/i,
  /\bbreathe (?:toward|into)\b/i,
  /\blet the breath move\b/i,
  /\bexhale take\b/i,
  /\bhidden tension\b/i,
  /\blet it go\b/i,
];

test('Body Scan uses a complete, direct nine-step script', () => {
  assert.equal(BODY_SCAN_SCRIPT.length, 9);
  assert.deepEqual(
    BODY_SCAN_INSTRUCTIONS,
    BODY_SCAN_SCRIPT.map((step) => step.text),
  );
  assert.equal(bodyScanInstructionsAreDirect(BODY_SCAN_INSTRUCTIONS), true);
});

test('Body Scan instructions contain no unclear physical metaphors', () => {
  for (const step of BODY_SCAN_SCRIPT) {
    for (const pattern of unclearBodyScanPatterns) {
      assert.doesNotMatch(step.text, pattern, `${step.label} must use direct instructions`);
    }
  }
});

test('Body Scan rejects stale curriculum scripts with unclear language', () => {
  const legacyExamples = [
    'Let your face stay quiet.',
    'Let your legs get heavy.',
    'Breathe toward the tension.',
    'Find hidden tension and let it go.',
  ];

  for (const legacyExample of legacyExamples) {
    const candidate = BODY_SCAN_INSTRUCTIONS.map((instruction, index) =>
      index === 2 ? legacyExample : instruction,
    );
    assert.equal(
      bodyScanInstructionsAreDirect(candidate),
      false,
      `legacy instruction should be rejected: ${legacyExample}`,
    );
  }
});
