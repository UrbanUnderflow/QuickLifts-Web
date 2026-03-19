const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createApiResponseRecorder,
  createGroupMeetCreateHandlerRuntime,
} = require('./_runtimeHarness.cjs');

test('POST on Group Meet create rejects requests that do not include host availability', async () => {
  const { handler } = createGroupMeetCreateHandlerRuntime();

  const req = {
    method: 'POST',
    body: {
      title: 'April sync',
      targetMonth: '2026-04',
      deadlineAt: '2026-03-26T17:00:00.000Z',
      timezone: 'America/New_York',
      meetingDurationMinutes: 30,
      sendEmails: true,
      host: {
        contactId: 'contact-host',
        availabilityEntries: [],
      },
      participants: [
        {
          contactId: 'contact-avery',
        },
      ],
    },
  };
  const res = createApiResponseRecorder();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.error, 'Add the host availability before sending the request.');
});

test('POST on Group Meet create rejects requests that are not built from saved contacts', async () => {
  const { handler } = createGroupMeetCreateHandlerRuntime();

  const req = {
    method: 'POST',
    body: {
      title: 'April sync',
      targetMonth: '2026-04',
      deadlineAt: '2026-03-26T17:00:00.000Z',
      timezone: 'America/New_York',
      meetingDurationMinutes: 30,
      sendEmails: true,
      host: {
        availabilityEntries: [
          { date: '2026-04-10', startMinutes: 540, endMinutes: 660 },
        ],
      },
      participants: [
        {
          contactId: 'contact-avery',
        },
      ],
    },
  };
  const res = createApiResponseRecorder();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.error, 'Choose the host from your contact list.');
});

test('POST on Group Meet create stores the host as a responded invite and emails only the guests', async () => {
  const { handler } = createGroupMeetCreateHandlerRuntime({
    baseUrl: 'https://admin.fitwithpulse.ai',
  });

  const req = {
    method: 'POST',
    body: {
      title: 'April sync',
      targetMonth: '2026-04',
      deadlineAt: '2026-03-26T17:00:00.000Z',
      timezone: 'America/New_York',
      meetingDurationMinutes: 30,
      sendEmails: true,
      host: {
        contactId: 'contact-host',
        availabilityEntries: [
          { date: '2026-04-10', startMinutes: 540, endMinutes: 660 },
        ],
      },
      participants: [
        {
          contactId: 'contact-avery',
        },
        {
          contactId: 'contact-host',
        },
      ],
    },
    headers: {
      host: 'admin.fitwithpulse.ai',
      'x-forwarded-proto': 'https',
    },
  };
  const res = createApiResponseRecorder();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.request.title, 'April sync');
  assert.equal(res.payload.request.participantCount, 2);
  assert.equal(res.payload.request.responseCount, 1);
  assert.equal(res.payload.request.invites.length, 2);

  const hostInvite = res.payload.request.invites.find((invite) => invite.participantType === 'host');
  const guestInvite = res.payload.request.invites.find((invite) => invite.participantType === 'participant');

  assert.ok(hostInvite);
  assert.ok(guestInvite);
  assert.equal(hostInvite.name, 'Tre');
  assert.equal(hostInvite.imageUrl, 'https://images.example.com/tre.png');
  assert.equal(hostInvite.contactId, 'contact-host');
  assert.equal(hostInvite.availabilityCount, 1);
  assert.equal(Boolean(hostInvite.respondedAt), true);
  assert.equal(hostInvite.emailStatus, 'manual_only');
  assert.match(hostInvite.shareUrl, /\/group-meet\//);

  assert.equal(guestInvite.name, 'Avery');
  assert.equal(guestInvite.imageUrl, 'https://images.example.com/avery.png');
  assert.equal(guestInvite.contactId, 'contact-avery');
  assert.equal(guestInvite.availabilityCount, 0);
  assert.equal(guestInvite.emailStatus, 'sent');
  assert.match(guestInvite.shareUrl, /^https:\/\/.+\/group-meet\//);

});
