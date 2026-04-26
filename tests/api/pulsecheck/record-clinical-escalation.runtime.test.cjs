'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const fn = require('../../../netlify/functions/record-clinical-escalation');

test('record-clinical-escalation — _private surface exists', () => {
  const priv = fn._private;
  for (const name of [
    'buildDedupeKey',
    'dayBucket',
    'buildClinicianEmail',
    'buildClinicianSms',
    'resolveDesignatedClinician',
    'isAdminClaim',
    'normalizeString',
  ]) {
    assert.equal(typeof priv[name], 'function', `_private.${name} must be a function`);
  }
});

test('record-clinical-escalation — buildDedupeKey is deterministic + sport/family-aware', () => {
  const { buildDedupeKey } = fn._private;
  const key1 = buildDedupeKey('athlete-1', 'pulsecheck_chat_classifier', '2026-04-25T20:00');
  const key2 = buildDedupeKey('athlete-1', 'pulsecheck_chat_classifier', '2026-04-25T20:00');
  const key3 = buildDedupeKey('athlete-1', 'pulsecheck_checkin_classifier', '2026-04-25T20:00');
  assert.equal(key1, key2);
  assert.notEqual(key1, key3);
  assert.ok(key1.includes('athlete-1'));
});

test('record-clinical-escalation — dayBucket buckets to fixed window starts', () => {
  const { dayBucket } = fn._private;
  const t1 = 1716660000; // some unix sec
  const t2 = t1 + 1500; // 25 min later — same bucket
  const t3 = t1 + 3700; // 61 min later — new bucket
  const window = 60 * 60;
  assert.equal(dayBucket(t1, window), dayBucket(t2, window));
  assert.notEqual(dayBucket(t1, window), dayBucket(t3, window));
});

test('record-clinical-escalation — isAdminClaim recognizes admin signals', () => {
  const { isAdminClaim } = fn._private;
  assert.equal(isAdminClaim(undefined), false);
  assert.equal(isAdminClaim({}), false);
  assert.equal(isAdminClaim({ admin: true }), true);
  assert.equal(isAdminClaim({ adminAccess: true }), true);
  assert.equal(isAdminClaim({ role: 'admin' }), true);
  assert.equal(isAdminClaim({ role: 'athlete' }), false);
});

test('record-clinical-escalation — clinician email surfaces athlete + team + 988 disclaimer', () => {
  const { buildClinicianEmail } = fn._private;
  const out = buildClinicianEmail({
    escalationId: 'esc-1',
    athleteUserId: 'athlete-1',
    athleteDisplayName: 'M. Johnson',
    teamName: 'Westbrook Athletics',
    evidence: [
      { label: 'self-harm-related language', excerpt: 'Anonymized excerpt for review' },
      { label: 'sustained sentiment shift', confidence: 'stable' },
    ],
    detectedAt: 1716660000,
    acknowledgeUrl: 'https://example.com/staff/clinical-escalations?ack=esc-1',
  });
  assert.ok(out.subject.includes('Tier 3'));
  assert.ok(out.subject.includes('Westbrook Athletics'));
  assert.ok(out.htmlContent.includes('M. Johnson'));
  assert.ok(out.htmlContent.includes('988'));
  assert.ok(out.htmlContent.includes('Crisis Text Line') || out.htmlContent.includes('741741'));
  assert.ok(
    out.htmlContent.includes('not initiating contact'),
    'must include not-initiating-contact disclaimer',
  );
  assert.ok(out.htmlContent.includes('Acknowledge'));
});

test('record-clinical-escalation — clinician SMS includes athlete + team + ack URL + 988 reminder', () => {
  const { buildClinicianSms } = fn._private;
  const out = buildClinicianSms({
    athleteDisplayName: 'M. Johnson',
    athleteUserId: 'athlete-1',
    teamName: 'Westbrook Athletics',
    acknowledgeUrl: 'https://example.com/staff/clinical-escalations?ack=esc-1',
  });
  assert.ok(out.includes('TIER 3'));
  assert.ok(out.includes('M. Johnson'));
  assert.ok(out.includes('Westbrook Athletics'));
  assert.ok(out.includes('988'));
  assert.ok(out.includes('https://example.com/staff/clinical-escalations?ack=esc-1'));
});

test('record-clinical-escalation — escapes HTML in clinician email payload', () => {
  const { buildClinicianEmail } = fn._private;
  const out = buildClinicianEmail({
    escalationId: 'esc-<2>',
    athleteUserId: 'athlete-1',
    athleteDisplayName: '<script>alert("xss")</script>',
    teamName: '<TEAM>',
    evidence: [{ label: '<dangerous>', excerpt: '"quoted"' }],
    detectedAt: 1716660000,
    acknowledgeUrl: 'https://example.com',
  });
  assert.ok(out.htmlContent.includes('&lt;script&gt;'), 'script tag must be escaped');
  assert.ok(out.htmlContent.includes('&lt;TEAM&gt;'), 'team angle brackets escaped');
  assert.ok(!out.htmlContent.includes('<script>alert'), 'no live script tag may pass through');
});

test('record-clinical-escalation — resolveDesignatedClinician picks primary, falls back to oldest active', async () => {
  const { resolveDesignatedClinician } = fn._private;

  const buildMockDb = (memberships) => ({
    collection() {
      return {
        where() {
          const builder = {
            where() { return builder; },
            async get() {
              return {
                docs: memberships.map((data, idx) => ({ id: `mem-${idx}`, data: () => data })),
              };
            },
          };
          return builder;
        },
      };
    },
  });

  // Empty case: returns null
  let db = buildMockDb([]);
  let result = await resolveDesignatedClinician(db, 'team-1');
  assert.equal(result, null);

  // Skips entries with missing email
  db = buildMockDb([
    { userId: 'u1', email: '', addedAt: 100 },
    { userId: 'u2', email: 'doc@example.com', addedAt: 200 },
  ]);
  result = await resolveDesignatedClinician(db, 'team-1');
  assert.equal(result?.email, 'doc@example.com');
  assert.equal(result?.userId, 'u2');

  // isPrimaryClinician wins regardless of addedAt
  db = buildMockDb([
    { userId: 'u1', email: 'first@example.com', addedAt: 100 },
    { userId: 'u2', email: 'primary@example.com', addedAt: 999, isPrimaryClinician: true },
  ]);
  result = await resolveDesignatedClinician(db, 'team-1');
  assert.equal(result?.email, 'primary@example.com');

  // No primary: oldest addedAt wins
  db = buildMockDb([
    { userId: 'u2', email: 'newer@example.com', addedAt: 999 },
    { userId: 'u1', email: 'older@example.com', addedAt: 100 },
  ]);
  result = await resolveDesignatedClinician(db, 'team-1');
  assert.equal(result?.email, 'older@example.com');
});

test('record-clinical-escalation — normalizeString trims + tolerates non-strings', () => {
  const { normalizeString } = fn._private;
  assert.equal(normalizeString('  hello  '), 'hello');
  assert.equal(normalizeString(''), '');
  assert.equal(normalizeString(undefined), '');
  assert.equal(normalizeString(null), '');
  assert.equal(normalizeString(42), '');
});
