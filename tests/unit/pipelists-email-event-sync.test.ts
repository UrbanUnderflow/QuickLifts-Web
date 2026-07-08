import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeBrevoEvents } from '../../src/pages/api/pipelists/check-email-events';
import {
  buildSyncedEmailEventLog,
  emailStatusRank,
  normalizeSyncedEmailStatus,
} from '../../src/utils/pipelistsEmailEventSync';

test('summarizeBrevoEvents promotes opened above delivered for a Brevo message', () => {
  const summary = summarizeBrevoEvents([
    {
      event: 'delivered',
      date: '2026-07-08T13:30:00.000Z',
    },
    {
      event: 'opened',
      date: '2026-07-08T13:35:00.000Z',
    },
  ]);

  assert.deepEqual(summary, {
    status: 'opened',
    eventAt: '2026-07-08T13:35:00.000Z',
    link: undefined,
  });
});

test('summarizeBrevoEvents treats Brevo unique/proxy opens as opened', () => {
  assert.equal(summarizeBrevoEvents([{ event: 'unique_opened', date: '2026-07-08T13:35:00.000Z' }])?.status, 'opened');
  assert.equal(summarizeBrevoEvents([{ event: 'proxy_open', date: '2026-07-08T13:35:00.000Z' }])?.status, 'opened');
});

test('buildSyncedEmailEventLog creates the exact PipeLists opened activity log', () => {
  const log = buildSyncedEmailEventLog({
    item: {
      id: 'contact-1',
      contactEmails: ['tremaine.grant@gmail.com'],
      lastEmailType: 'metrics-update',
    },
    status: 'opened',
    messageId: '<brevo-message-1@example>',
    eventAt: '2026-07-08T13:35:00.000Z',
  });

  assert.equal(log.id, 'email-event--brevo-message-1-example--opened');
  assert.equal(log.type, 'metrics');
  assert.equal(log.weekOf, '2026-07-08');
  assert.equal(log.summary, 'Investor Update opened by tremaine.grant@gmail.com.');
  assert.equal(log.systemAction, 'email-sent');
  assert.equal(log.relatedItemId, 'contact-1');
  assert.equal(
    log.notes,
    ['To: tremaine.grant@gmail.com', 'Status: Opened', 'Message ID: <brevo-message-1@example>'].join('\n'),
  );
});

test('email status ranking does not downgrade opened to delivered or sent', () => {
  assert.equal(normalizeSyncedEmailStatus('unique_opened'), 'opened');
  assert.ok(emailStatusRank('opened') > emailStatusRank('delivered'));
  assert.ok(emailStatusRank('delivered') > emailStatusRank('sent'));
});
