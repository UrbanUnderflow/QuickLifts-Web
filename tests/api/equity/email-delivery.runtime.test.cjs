const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');
const {getEquityEmailDelivery, applyBrevoEmailEvent, normalizeBrevoMessageId, brevoEmailEventTimestamp} = loadTs(path.join(__dirname, '../../../src/lib/equityEmailDelivery.ts'));
const current = () => ({status: 'accepted', messageId: '<current@brevo>', recipientEmail: 'person@example.test', attemptId: 'attempt-2', attemptedAt: '2026-09-23T22:00:00.999Z'});
const event = (type, extra = {}) => ({event: type, messageId: 'current@brevo', email: 'Person@Example.Test', date: '2026-09-23T22:01:00Z', ...extra});

test('legacy sent is accepted by Brevo, never confirmed delivered', () => {
  assert.equal(getEquityEmailDelivery({emailStatus: 'sent', messageId: '<id>', recipientEmail: 'PERSON@example.test'}).status, 'accepted');
  assert.equal(getEquityEmailDelivery({status: 'signed', recipientEmail: 'person@example.test'}).status, 'unknown');
});
test('legacy sent without a provider message ID remains unconfirmed', () => {
  for (const messageId of [undefined, null, '', ' ']) {
    assert.equal(getEquityEmailDelivery({emailStatus: 'sent', messageId, recipientEmail: 'person@example.test'}).status, 'unknown');
    assert.equal(getEquityEmailDelivery({status: 'sent', sentAt: '2026-09-23T22:00:00Z', messageId}).status, 'unknown');
  }
});
test('previously persisted accepted delivery without an ID is unconfirmed and retains its failure history', () => {
  const failure = {reason: 'Earlier attempt blocked', at: '2026-09-23T21:00:00Z', messageId: 'earlier'};
  const reason = 'The provider message ID was not recorded';
  for (const messageId of [undefined, null, '', ' ']) {
    const delivery = getEquityEmailDelivery({emailDelivery: {status: 'accepted', messageId, recipientEmail: 'person@example.test', reason, unresolvedFailure: failure, checkError: 'No Brevo message ID'}});
    assert.equal(delivery.status, 'unknown'); assert.equal(delivery.reason, reason);
    assert.equal(delivery.unresolvedFailure, failure); assert.equal(delivery.checkError, 'No Brevo message ID');
  }
  assert.equal(getEquityEmailDelivery({emailDelivery: {status: 'accepted', messageId: '<recorded@brevo>', recipientEmail: 'person@example.test'}}).status, 'accepted');
});
test('legacy hard bounce becomes a persistent unresolved failure', () => {
  const delivery = getEquityEmailDelivery({emailStatus: 'hard_bounce', messageId: 'old', emailError: 'Mailbox missing'});
  assert.equal(delivery.status, 'failed'); assert.equal(delivery.unresolvedFailure.reason, 'Mailbox missing');
});
test('message IDs normalize brackets without conflating case or unrelated strings', () => {
  assert.equal(normalizeBrevoMessageId(' <Message@Brevo> '), 'Message@Brevo');
  assert.equal(normalizeBrevoMessageId('message@Brevo'), 'message@Brevo');
});
for (const [type, status] of [['request','accepted'],['delivered','delivered'],['uniqueOpened','delivered'],['proxy_open','delivered'],['click','delivered'],['softBounce','deferred'],['deferred','deferred'],['hard_bounce','failed'],['blocked','failed'],['invalid_email','failed'],['error','failed']]) {
  test(`maps Brevo ${type} to ${status}`, () => {assert.equal(applyBrevoEmailEvent(current(), event(type)).status, status);});
}
test('events from a previous send, wrong recipient, unknown event or missing timestamp are ignored', () => {
  const original = current();
  for (const changed of [{messageId:'old@brevo'}, {email:'someone@example.test'}, {event:'other'}, {date:undefined}, {date:'2026-09-23 22:00:00'}]) assert.equal(applyBrevoEmailEvent(original,event('delivered',changed)), original);
});
test('events before the current attempt are rejected, allowing only second rounding', () => {
  const original = current();
  assert.equal(applyBrevoEmailEvent(original,event('error',{date:'2026-09-23T21:59:59Z'})), original);
  assert.equal(applyBrevoEmailEvent(original,event('request',{date:'2026-09-23T22:00:00Z'})).status, 'accepted');
});
test('provider UTC event time wins over timezone-ambiguous webhook date', () => {
  assert.equal(brevoEmailEventTimestamp({date:'2026-09-23 22:00:00',ts_event:1790200800}),1790200800000);
});
test('late request/deferred events cannot clear a failure; later delivery can', () => {
  const failed = applyBrevoEmailEvent(current(),event('error',{reason:'Sending domain not authorized'}));
  assert.equal(failed.unresolvedFailure.reason, 'Sending domain not authorized');
  for (const type of ['request','deferred']) assert.equal(applyBrevoEmailEvent(failed,event(type,{date:'2026-09-23T22:02:00Z'})),failed);
  const delivered = applyBrevoEmailEvent(failed,event('delivered',{date:'2026-09-23T22:02:00Z'}));
  assert.equal(delivered.status,'delivered'); assert.equal(delivered.unresolvedFailure,null);
});
test('out-of-order events and subsequent failures cannot erase confirmed delivery', () => {
  const delivered = applyBrevoEmailEvent(current(),event('delivered'));
  for (const changed of [{date:'2026-09-23T22:00:30Z'}, {date:'2026-09-23T22:02:00Z'}]) assert.equal(applyBrevoEmailEvent(delivered,event('hard_bounce',changed)),delivered);
});
test('a retry retains unresolved previous failure until delivery is confirmed', () => {
  const retry = {...current(),unresolvedFailure:{reason:'Earlier attempt blocked',at:'2026-09-23T21:00:00Z',messageId:'previous'}};
  assert.equal(applyBrevoEmailEvent(retry,event('request')).unresolvedFailure.reason,'Earlier attempt blocked');
  assert.equal(applyBrevoEmailEvent(retry,event('delivered')).unresolvedFailure,null);
});
