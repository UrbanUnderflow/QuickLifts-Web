const test = require('node:test');
const assert = require('node:assert/strict');
// Push payload helpers are real; unrelated pilot metrics must not initialize Firebase in unit tests.
const metricsPath = require.resolve('../../netlify/functions/utils/pulsecheck-pilot-metrics');
require.cache[metricsPath] = { id: metricsPath, filename: metricsPath, loaded: true, exports: {} };
const { sendTeamPaymentFailureNotifications, deliverChannel, LEASE_MS } = require('../../netlify/functions/lib/pulsecheck-team-payment-notifications');

function fixture() {
  const records = new Map([
    ['users/athlete', { email: 'athlete@example.test', pulseCheckFcmToken: 'pulse-token', pushTokenSourceApp: 'pulsecheck' }],
    ['pulsecheck-teams/team', { name: 'Building Bodies <Team>' }],
  ]);
  const ref = (path) => ({
    path,
    get: async () => ({ exists: records.has(path), data: () => records.get(path) }),
    set: async (data) => records.set(path, { ...(records.get(path) || {}), ...data }),
  });
  let queue = Promise.resolve();
  const database = {
    collection: (collection) => ({ doc: (id) => ref(`${collection}/${id}`) }),
    runTransaction: (callback) => {
      const result = queue.then(() => callback({ get: (r) => r.get(), set: (r, data) => r.set(data) }));
      queue = result.catch(() => {});
      return result;
    },
  };
  const emails = [], pushes = [];
  const args = {
    database, firebaseMode: 'prod',
    invoice: { id: 'in_test', livemode: true, status: 'open', amount_remaining: 4000 },
    subscription: { id: 'sub_test', livemode: true, metadata: { userId: 'athlete', pulsecheckTeamId: 'team' } },
    sendEmail: async (message) => { emails.push(message); return { success: true, messageId: 'email-id' }; },
    messaging: { send: async (message) => { pushes.push(message); return 'push-id'; } },
  };
  return { args, records, emails, pushes };
}

test('first failure sends both channels; repeat invoices do not send again', async () => {
  const f = fixture();
  await sendTeamPaymentFailureNotifications(f.args);
  await sendTeamPaymentFailureNotifications(f.args);
  assert.equal(f.emails.length, 1);
  assert.equal(f.pushes.length, 1);
  assert.match(f.emails[0].htmlContent, /Building Bodies &lt;Team&gt;/);
  assert.doesNotMatch(f.emails[0].htmlContent, /insufficient funds|\$29/);
  const url = 'https://fitwithpulse.ai/PulseCheck/team-billing?teamId=team';
  assert.match(f.emails[0].htmlContent, new RegExp(url.replace('?', '\\?')));
  assert.equal(f.emails[0].bypassDailyRecipientLimit, true);
  assert.equal(f.pushes[0].data.webUrl, url);
  assert.equal(f.pushes[0].data.type, 'payment_failed');
  assert.equal(f.pushes[0].data.screen, 'team_billing');
  assert.equal(f.pushes[0].notification, undefined);
  assert.equal(f.pushes[0].android.notification, undefined);
  assert.ok(f.pushes[0].apns.payload.aps.alert.body);
});

test('failed push retries without repeating successful email', async () => {
  const f = fixture();
  let calls = 0;
  f.args.messaging.send = async () => { if (++calls === 1) throw new Error('FCM temporarily unavailable'); return 'push-id'; };
  await assert.rejects(sendTeamPaymentFailureNotifications(f.args), /FCM temporarily unavailable/);
  await sendTeamPaymentFailureNotifications(f.args);
  assert.equal(f.emails.length, 1);
  assert.equal(calls, 2);
});

test('failed email retries without repeating successful push', async () => {
  const f = fixture();
  let calls = 0;
  f.args.sendEmail = async () => ++calls === 1 ? { success: false, error: 'provider unavailable' } : { success: true, messageId: 'email-id' };
  await assert.rejects(sendTeamPaymentFailureNotifications(f.args), /provider unavailable/);
  await sendTeamPaymentFailureNotifications(f.args);
  assert.equal(f.pushes.length, 1);
  assert.equal(calls, 2);
});

test('an in-progress email helper lock is retried, never recorded as sent', async () => {
  const f = fixture();
  f.args.sendEmail = async () => ({ success: true, skipped: true });
  await assert.rejects(sendTeamPaymentFailureNotifications(f.args), /pending/);
  assert.equal(f.records.get('pulsecheck-team-payment-notifications/in_test_email').status, 'failed');
});

test('non-production Firebase and Stripe test events do not send externally', async () => {
  for (const overrides of [{ firebaseMode: 'dev' }, { invoice: { id: 'in_test', status: 'open', amount_remaining: 4000, livemode: false } }]) {
    const f = fixture();
    Object.assign(f.args, overrides);
    await sendTeamPaymentFailureNotifications(f.args);
    assert.equal(f.emails.length, 0);
    assert.equal(f.pushes.length, 0);
    assert.equal(f.records.get('pulsecheck-team-payment-notifications/in_test_email').status, 'suppressed');
    if (f.args.firebaseMode === 'dev') assert.match(f.records.get('pulsecheck-team-payment-notifications/in_test_email').paymentUrl, /devFirebase=1/);
  }
});

test('already paid or void invoices do not send', async () => {
  for (const status of ['paid', 'void']) {
    const f = fixture();
    f.args.invoice.status = status;
    await sendTeamPaymentFailureNotifications(f.args);
    assert.equal(f.emails.length + f.pushes.length, 0);
  }
});

test('missing push token stays observable and can send on a later retry', async () => {
  const f = fixture();
  delete f.records.get('users/athlete').pulseCheckFcmToken;
  await sendTeamPaymentFailureNotifications(f.args);
  assert.equal(f.records.get('pulsecheck-team-payment-notifications/in_test_push').status, 'unavailable');
  f.records.get('users/athlete').pulseCheckFcmToken = 'new-token';
  await sendTeamPaymentFailureNotifications(f.args);
  assert.equal(f.emails.length, 1);
  assert.equal(f.pushes.length, 1);
});

test('concurrent delivery cannot acknowledge or duplicate an active lease', async () => {
  const f = fixture();
  let release, started;
  const start = new Promise((resolve) => { started = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  const args = { database: f.args.database, invoiceId: 'in_concurrent', channel: 'push', context: {}, deliver: async () => { started(); await gate; return { success: true, messageId: 'one' }; } };
  const first = deliverChannel(args);
  await start;
  await assert.rejects(deliverChannel(args), /in progress/);
  release();
  await first;
  assert.equal((await deliverChannel(args)).status, 'already_complete');
});

test('abandoned lease becomes retryable', async () => {
  const f = fixture();
  f.records.set('pulsecheck-team-payment-notifications/in_stale_push', { status: 'sending', claimedAtMs: 0 });
  const result = await deliverChannel({ database: f.args.database, invoiceId: 'in_stale', channel: 'push', context: {}, now: () => LEASE_MS + 1, deliver: async () => ({ success: true, messageId: 'recovered' }) });
  assert.equal(result.status, 'sent');
});
