const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function runtime(failingEmail) {
  const emails = [];
  const source = fs.readFileSync('src/lib/groupMeetAdmin.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  }}).outputText;
  const firestore = Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'now' } });
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, process, console,
    require(name) {
      if (name === './firebase-admin') return { firestore };
      if (name.includes('emailSequenceHelpers')) return {
        buildEmailDedupeKey: parts => parts.join('|'),
        sendBrevoTransactionalEmail: async email => {
          emails.push(email);
          if (email.toEmail === failingEmail) throw new Error('test provider failure');
          return { success: true, skipped: false };
        },
      };
      if (name === './groupMeetWorkflow') return {
        computeGroupMeetAiRecommendation: async () => ({ recommendation: { recommendations: [], caveats: [], summary: 'Ready' } }),
      };
      return {};
    },
  });
  return { emails, notify: exports.maybeNotifyGroupMeetHostAfterAvailabilitySave };
}
function invite(token, email, responded = false, participantType = 'participant') {
  return { token, email, name: token, participantType,
    respondedAt: responded ? '2026-10-19T12:00:00Z' : null, availabilityEntries: [] };
}
function args(invites, responderToken = 'guest') {
  return { invites, responderToken, responseAction: 'added', requestId: 'meeting',
    requestRef: { set: async () => {} }, requestData: { title: 'Review', participantCount: invites.length },
    baseUrl: 'https://example.com' };
}
test('availability updates reach each unique email, including the responder, with recipient-specific dedupe', async () => {
  const { emails, notify } = runtime();
  await notify(args([invite('host', 'host@example.com', true, 'host'), invite('guest', 'guest@example.com', true),
    invite('pending', 'pending@example.com'), invite('duplicate', ' GUEST@example.com '), invite('manual', '')]));
  assert.deepEqual(emails.map(e => e.toEmail).sort(), ['GUEST@example.com', 'host@example.com', 'pending@example.com'].sort());
  assert.equal(new Set(emails.map(e => e.idempotencyKey)).size, 3);
  const guest = emails.find(e => e.toEmail === 'GUEST@example.com');
  assert.match(guest.htmlContent, /host will review/);
  assert.doesNotMatch(guest.htmlContent, /choose from directly/);
});
test('host submissions and requests without a host email notify participants', async () => {
  for (const hostEmail of ['host@example.com', '']) {
    const { emails, notify } = runtime();
    await notify(args([invite('host', hostEmail, true, 'host'), invite('pending', 'pending@example.com')], 'host'));
    assert.ok(emails.some(e => e.toEmail === 'pending@example.com'));
  }
});
test('one delivery failure does not prevent other recipients from being notified', async () => {
  const { emails, notify } = runtime('guest@example.com');
  await notify(args([invite('guest', 'guest@example.com', true), invite('pending', 'pending@example.com')]));
  assert.equal(emails.length, 2);
});
test('empty availability does not send notifications', async () => {
  const { emails, notify } = runtime();
  await notify(args([invite('guest', 'guest@example.com')]));
  assert.equal(emails.length, 0);
});

test('the final response notifies guests and keeps the completion email with the host', async () => {
  const { emails, notify } = runtime();
  await notify(args([invite('host', 'host@example.com', true, 'host'), invite('guest', 'guest@example.com', true)]));
  assert.equal(emails.length, 2);
  assert.match(emails.find(e => e.toEmail === 'host@example.com').subject, /everyone added availability/);
  const guest = emails.find(e => e.toEmail === 'guest@example.com');
  assert.match(guest.subject, /guest added availability/);
  assert.doesNotMatch(guest.htmlContent, /Select this meeting time|finalize the time/);
});
